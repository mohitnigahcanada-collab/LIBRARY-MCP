import { loadConfig } from '../config/manager.js'

export async function sendTelegram(message: string): Promise<boolean> {
  const config = loadConfig()
  const { telegram_bot_token, telegram_chat_id } = config.alerts
  if (!telegram_bot_token || !telegram_chat_id) return false

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${telegram_bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegram_chat_id, text: message, parse_mode: 'HTML' }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

export async function sendSlack(message: string): Promise<boolean> {
  const config = loadConfig()
  const { slack_webhook } = config.alerts
  if (!slack_webhook) return false

  try {
    const res = await fetch(slack_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendAlert(message: string): Promise<{ telegram: boolean; slack: boolean }> {
  const [telegram, slack] = await Promise.all([sendTelegram(message), sendSlack(message)])
  return { telegram, slack }
}
