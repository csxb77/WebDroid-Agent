import {
  Cable,
  Camera,
  Usb,
  Unplug,
} from 'lucide-react'
import type { AppCopy } from '../lib/appCopy'
import type { DeviceControlActions, DeviceControlState } from '../lib/deviceControlTypes'
import { formatCurrentAppLabel } from './deviceDisplay'

export type DevicePanelProps = {
  copy: AppCopy
  state: DeviceControlState
  actions: DeviceControlActions
  sectionId?: string
}

export function DevicePanel({
  actions,
  copy,
  sectionId,
  state,
}: DevicePanelProps) {
  const {
    busyTask,
    connected,
    deviceInfo,
    deviceState,
    currentApp,
  } = state
  const {
    onCaptureScreen,
    onConnectDevice,
    onDisconnectDevice,
  } = actions
  const isBusy = Boolean(busyTask)
  const currentAppLabel = formatCurrentAppLabel(currentApp, copy)
  const deviceLabel = deviceInfo?.name || copy.noDevice
  const deviceBadgeTone = connected ? 'neutral' : 'warning'

  return (
    <section className="config-panel-group" id={sectionId} aria-label={copy.device}>
      <div className="config-section-heading">
        <div className="panel-title">
          <Usb size={18} />
          <h2>{copy.device}</h2>
        </div>
        <span className={`config-section-badge ${deviceBadgeTone}`}>
          {connected ? currentAppLabel : copy.noDevice}
        </span>
      </div>
      <div className="device-box">
        <span>{deviceLabel}</span>
        {connected && deviceInfo ? (
          <details className="device-details">
            <summary>{copy.deviceDetails}</summary>
            <small>{copy.serial}: {deviceInfo.serial}</small>
            <small>{copy.currentApp}: {currentAppLabel}</small>
            {deviceState.packageName ? (
              <small>{copy.package}: {deviceState.packageName}</small>
            ) : null}
            {deviceState.activity ? <small>{copy.activity}: {deviceState.activity}</small> : null}
            {deviceState.keyboard ? <small>{copy.keyboard}: {deviceState.keyboard}</small> : null}
          </details>
        ) : (
          <>
            <small>{copy.usbDebuggingRequired}</small>
            <small>{copy.currentApp}: {currentAppLabel}</small>
          </>
        )}
      </div>
      <div className="button-row">
        <button
          type="button"
          className="primary"
          onClick={onConnectDevice}
          disabled={isBusy || connected}
        >
          <Cable size={16} />
          {copy.connect}
        </button>
        {connected ? (
          <button
            type="button"
            className="secondary"
            onClick={onDisconnectDevice}
            disabled={isBusy}
          >
            <Unplug size={16} />
            {copy.disconnect}
          </button>
        ) : null}
      </div>
      {connected ? (
        <button
          type="button"
          className="wide secondary"
          onClick={onCaptureScreen}
          disabled={isBusy}
        >
          <Camera size={16} />
          {copy.capture}
        </button>
      ) : null}
    </section>
  )
}
