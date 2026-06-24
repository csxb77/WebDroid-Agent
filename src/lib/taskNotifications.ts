export type TaskNotificationPayload = {
  title: string
  detail?: string
}

export function isTaskNotificationSupported() {
  return typeof globalThis.Notification === 'function'
}

export async function requestTaskNotificationPermission() {
  if (!isTaskNotificationSupported()) {
    return 'denied' as NotificationPermission
  }

  if (globalThis.Notification.permission === 'granted') {
    return 'granted' as NotificationPermission
  }
  if (globalThis.Notification.permission === 'denied') {
    return 'denied' as NotificationPermission
  }

  return globalThis.Notification.requestPermission()
}

export function showTaskNotification({ detail, title }: TaskNotificationPayload) {
  if (!isTaskNotificationSupported() || globalThis.Notification.permission !== 'granted') {
    return false
  }

  try {
    new globalThis.Notification(title, {
      body: detail,
      icon: '/webdroid-agent-logo-128.png',
    })
    return true
  } catch {
    return false
  }
}
