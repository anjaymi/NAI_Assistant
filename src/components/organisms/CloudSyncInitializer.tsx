import { useEffect } from 'react'
import { startCloudSyncPuller, stopCloudSyncPuller } from '@/services/cloud-pull-service'
import { useSettingsStore } from '@/stores/settings-store'
import { useSync } from '@/context/SyncContext'

export function CloudSyncInitializer() {
  const manualToken = useSettingsStore((state) => state.cloudSyncToken)
  const { user } = useSync()
  const effectiveToken = user?.id || manualToken || ''

  useEffect(() => {
    if (!effectiveToken) return

    startCloudSyncPuller(effectiveToken)
    return () => stopCloudSyncPuller()
  }, [effectiveToken])

  return null
}
