#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IHttpRequest.h"
#include "TourismTelemetrySubsystem.generated.h"

// Put both files in your game's Source/<Module>/ directory.
UCLASS(Config=Game)
class UTourismTelemetrySubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

private:
    UPROPERTY(Config) bool bEnabled = false;
    UPROPERTY(Config) FString ServiceUrl = TEXT("http://127.0.0.1:3001");
    UPROPERTY(Config) FString IngestToken;
    FTimerHandle UploadTimer;
    TSharedPtr<IHttpRequest, ESPMode::ThreadSafe> ActiveRequest;
    FString SessionId;
    FString CounterDay;
    FString PendingBody;
    int32 Sequence = 0;
    int32 EnteredToday = 0;
    int32 ExitedToday = 0;
    bool bStopped = true;
    void RestoreCounters();
    void Upload();
    void StopWithError(const FString& Message);
};
