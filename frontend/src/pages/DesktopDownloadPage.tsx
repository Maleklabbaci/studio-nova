import { Download, MonitorDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Accent, PageIntro } from '@/features/marketing/PageIntro'
import { usePageMeta } from '@/lib/usePageMeta'
import { AnchorButton, Button } from '@/ui'
import styles from './DesktopDownloadPage.module.css'

type Platform = 'windows' | 'macos'
type DownloadManifest = { version?: string; downloads?: Partial<Record<Platform, string>> }

const PLATFORMS: Array<{ id: Platform; name: string; detail: string; extension: string }> = [
  { id: 'windows', name: 'Windows', detail: 'Windows 10 or later · 64-bit', extension: '.exe' },
  { id: 'macos', name: 'macOS', detail: 'Apple silicon and Intel · universal', extension: '.dmg' },
]

/**
 * Installers of the latest published release. Used when the deployed
 * /downloads/manifest.json is missing or still empty, so the download
 * buttons work on any static deployment of this page.
 */
const FALLBACK_DOWNLOADS: Partial<Record<Platform, string>> = {
  windows: 'https://github.com/Maleklabbaci/studio-nova/releases/latest/download/StudioNova-win-x64.exe',
  macos: 'https://github.com/Maleklabbaci/studio-nova/releases/latest/download/StudioNova-mac-universal.dmg',
}

const INSTALLER_FILE = /^[A-Za-z0-9._-]+\.(?:exe|dmg)$/

/**
 * Resolve a manifest entry to a download href. Entries may be a plain file
 * name (served from this site's /downloads/) or a full https URL — desktop
 * installers are far above the 25 MB per-file limit of static hosts such as
 * Cloudflare Pages, so releases are hosted on GitHub Releases instead.
 */
function validInstaller(entry: unknown): string | null {
  if (typeof entry !== 'string') return null
  if (INSTALLER_FILE.test(entry)) return `/downloads/${entry}`
  try {
    const url = new URL(entry)
    if (url.protocol === 'https:' && INSTALLER_FILE.test(url.pathname.split('/').pop() ?? '')) return url.toString()
  } catch {
    return null
  }
  return null
}

export default function DesktopDownloadPage() {
  const [downloads, setDownloads] = useState<Partial<Record<Platform, string>>>({})
  const [version, setVersion] = useState<string | null>(null)

  usePageMeta({
    title: 'Studio Nova for desktop',
    description: 'Install Studio Nova on Windows or macOS and keep designing from your computer.',
    canonical: '/download',
  })

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/downloads/manifest.json', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<DownloadManifest> : null))
      .then((manifest) => {
        if (!manifest) {
          setDownloads(FALLBACK_DOWNLOADS)
          return
        }
        setVersion(typeof manifest.version === 'string' ? manifest.version : null)
        const fromManifest: Partial<Record<Platform, string>> = {
          windows: validInstaller(manifest.downloads?.windows) ?? undefined,
          macos: validInstaller(manifest.downloads?.macos) ?? undefined,
        }
        // An empty/stale manifest must not disable the buttons: fall back
        // to the latest GitHub release per missing platform.
        setDownloads({
          windows: fromManifest.windows ?? FALLBACK_DOWNLOADS.windows,
          macos: fromManifest.macos ?? FALLBACK_DOWNLOADS.macos,
        })
      })
      .catch(() => setDownloads(FALLBACK_DOWNLOADS))
    return () => controller.abort()
  }, [])

  const hasInstallers = PLATFORMS.some(({ id }) => downloads[id])

  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="made for your computer"
        title={
          <>
            Studio Nova for <Accent>desktop</Accent>
          </>
        }
        lead="Install Studio Nova on your computer and keep your creative workspace close at hand."
        bubble="ready to install?"
      />

      <section className={styles.section} aria-labelledby="desktop-downloads-title">
        <div className={styles.sectionHead}>
          <h2 id="desktop-downloads-title" className={styles.heading}>Choose your computer</h2>
          {version ? <span className={styles.version}>Version {version}</span> : null}
        </div>
        <ul className={styles.platforms}>
          {PLATFORMS.map(({ id, name, detail, extension }) => {
            const href = downloads[id]
            const filename = href?.split('/').pop()
            return (
              <li key={id} className={styles.card}>
                <span className={styles.icon} aria-hidden="true"><MonitorDown size={22} /></span>
                <h3 className={styles.platformName}>{name}</h3>
                <p className={styles.detail}>{detail}</p>
                {href ? (
                  <AnchorButton href={href} download={filename} rightIcon={<Download size={17} aria-hidden="true" />} className={styles.install}>
                    Download {extension}
                  </AnchorButton>
                ) : (
                  <Button type="button" disabled rightIcon={<Download size={17} aria-hidden="true" />} className={styles.install}>
                    Installer coming soon
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <p className={styles.note} role="status">
          {hasInstallers
            ? 'Choose the installer for your computer, then open the downloaded file to finish setup.'
            : 'Installers are being prepared. The download buttons will appear here when the desktop release is published.'}
        </p>
        <p className={styles.note}>
          Guest designs stay on this device. Cloud accounts and AI assistance need a configured Studio Nova server and AI key.
        </p>
      </section>
    </div>
  )
}
