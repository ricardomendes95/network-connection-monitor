export const IPC_CHANNELS = {
  GET_HISTORY: 'speed:get-history',
  GET_CHART_DATA: 'speed:get-chart-data',
  RUN_NOW: 'speed:run-now',
  GET_STATUS: 'speed:get-status',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  GET_NETWORK_INFO: 'network:get-info',
  NETWORK_INFO_UPDATE: 'network:info-update',

  TEST_STARTED: 'speed:test-started',
  TEST_COMPLETED: 'speed:test-completed',
  TEST_FAILED: 'speed:test-failed',
  SPEED_ALERT: 'speed:alert',
  SCHEDULER_TICK: 'speed:scheduler-tick',

  EXPORT_PDF: 'export:pdf',
  SAVE_PNG: 'export:save-png',
  EXPORT_EVIDENCE: 'export:evidence',
  EXPORT_EVIDENCE_PDF: 'export:evidence-pdf',

  AUTOSTART_GET: 'app:autostart-get',
  AUTOSTART_SET: 'app:autostart-set'
} as const
