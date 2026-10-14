#include "TourismTelemetrySubsystem.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Engine/World.h"
#include "TimerManager.h"

namespace
{
    FString GetChinaDay()
    {
        return (FDateTime::UtcNow() + FTimespan::FromHours(8)).ToString(TEXT("%Y-%m-%d"));
    }
}

void UTourismTelemetrySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    if (!bEnabled) return;
    if (IngestToken.Len() < 16)
    {
        UE_LOG(LogTemp, Error, TEXT("Tourism: configure a private IngestToken before enabling telemetry."));
        return;
    }
    bStopped = false;
    SessionId = FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens);
    CounterDay = GetChinaDay();
    RestoreCounters();
}

void UTourismTelemetrySubsystem::StopWithError(const FString& Message)
{
    bStopped = true;
    if (UWorld* World = GetWorld()) World->GetTimerManager().ClearTimer(UploadTimer);
    UE_LOG(LogTemp, Error, TEXT("Tourism: %s"), *Message);
}

void UTourismTelemetrySubsystem::RestoreCounters()
{
    ActiveRequest = FHttpModule::Get().CreateRequest();
    ActiveRequest->SetURL(ServiceUrl / TEXT("api/dashboard"));
    ActiveRequest->SetVerb(TEXT("GET"));
    ActiveRequest->SetTimeout(10.0f);
    ActiveRequest->OnProcessRequestComplete().BindWeakLambda(this,
        [this](FHttpRequestPtr Request, FHttpResponsePtr Response, bool bSuccess)
        {
            if (bStopped) return;
            ActiveRequest.Reset();
            if (!bSuccess || !Response.IsValid() || Response->GetResponseCode() != 200)
            {
                StopWithError(TEXT("Cannot restore counters. Start the backend, then restart PIE."));
                return;
            }
            TSharedPtr<FJsonObject> Root;
            const auto Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
            bool bSameDay = false;
            if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid() || !Root->TryGetBoolField(TEXT("sameDay"), bSameDay))
            {
                StopWithError(TEXT("Invalid dashboard response."));
                return;
            }
            if (bSameDay)
            {
                const TSharedPtr<FJsonObject>* Latest = nullptr;
                FString Source;
                double Entered = 0, Exited = 0;
                if (!Root->TryGetObjectField(TEXT("latest"), Latest) || !Latest || !Latest->IsValid()
                    || !(*Latest)->TryGetStringField(TEXT("source"), Source) || Source != TEXT("ue-simulation")
                    || !(*Latest)->TryGetNumberField(TEXT("enteredToday"), Entered)
                    || !(*Latest)->TryGetNumberField(TEXT("exitedToday"), Exited))
                {
                    StopWithError(TEXT("Data source is incompatible. Use a separate store for local simulation and UE."));
                    return;
                }
                EnteredToday = static_cast<int32>(Entered);
                ExitedToday = static_cast<int32>(Exited);
            }
            if (UWorld* World = GetWorld())
            {
                World->GetTimerManager().SetTimer(UploadTimer, this, &UTourismTelemetrySubsystem::Upload, 5.0f, true);
                Upload();
            }
            else StopWithError(TEXT("No world available for the upload timer."));
        });
    if (!ActiveRequest->ProcessRequest()) StopWithError(TEXT("Failed to start dashboard request."));
}

void UTourismTelemetrySubsystem::Upload()
{
    if (bStopped || ActiveRequest.IsValid()) return;
    // Retain the exact payload on transport failure; resending does not double count.
    if (PendingBody.IsEmpty())
    {
        const FString Today = GetChinaDay();
        if (CounterDay != Today) { CounterDay = Today; EnteredToday = 0; ExitedToday = 0; }
        EnteredToday += FMath::RandRange(8, 37);
        ExitedToday += FMath::Min(EnteredToday - ExitedToday, FMath::RandRange(0, 19));
        auto Payload = MakeShared<FJsonObject>();
        Payload->SetStringField(TEXT("parkId"), TEXT("zhangjiajie-demo"));
        Payload->SetStringField(TEXT("sessionId"), SessionId);
        Payload->SetNumberField(TEXT("sequence"), ++Sequence);
        Payload->SetStringField(TEXT("sampledAt"), FDateTime::UtcNow().ToIso8601());
        Payload->SetStringField(TEXT("source"), TEXT("ue-simulation"));
        Payload->SetNumberField(TEXT("enteredToday"), EnteredToday);
        Payload->SetNumberField(TEXT("exitedToday"), ExitedToday);
        Payload->SetNumberField(TEXT("occupancy"), EnteredToday - ExitedToday);
        const auto Writer = TJsonWriterFactory<>::Create(&PendingBody);
        FJsonSerializer::Serialize(Payload, Writer);
    }
    ActiveRequest = FHttpModule::Get().CreateRequest();
    ActiveRequest->SetURL(ServiceUrl / TEXT("api/ingest"));
    ActiveRequest->SetVerb(TEXT("POST"));
    ActiveRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    ActiveRequest->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + IngestToken);
    ActiveRequest->SetContentAsString(PendingBody);
    ActiveRequest->SetTimeout(10.0f);
    ActiveRequest->OnProcessRequestComplete().BindWeakLambda(this,
        [this](FHttpRequestPtr Request, FHttpResponsePtr Response, bool bSuccess)
        {
            if (bStopped) return;
            ActiveRequest.Reset();
            if (!bSuccess || !Response.IsValid())
            {
                UE_LOG(LogTemp, Warning, TEXT("Tourism: transport interrupted; retaining payload for retry."));
                return;
            }
            const int32 Code = Response->GetResponseCode();
            if (Code >= 200 && Code < 300) PendingBody.Empty();
            else if (Code >= 400 && Code < 500)
                StopWithError(FString::Printf(TEXT("Upload rejected (%d): %s. Resolve the cause, then restart PIE."), Code, *Response->GetContentAsString()));
            else UE_LOG(LogTemp, Warning, TEXT("Tourism: server error %d; retaining payload for retry."), Code);
        });
    if (!ActiveRequest->ProcessRequest())
    {
        ActiveRequest.Reset();
        UE_LOG(LogTemp, Warning, TEXT("Tourism: upload could not start; retrying at the next interval."));
    }
}

void UTourismTelemetrySubsystem::Deinitialize()
{
    bStopped = true;
    if (UWorld* World = GetWorld()) World->GetTimerManager().ClearTimer(UploadTimer);
    if (ActiveRequest.IsValid())
    {
        ActiveRequest->OnProcessRequestComplete().Unbind();
        ActiveRequest->CancelRequest();
        ActiveRequest.Reset();
    }
    Super::Deinitialize();
}
