import { Cloud, FolderOpen, HardDrive, LayoutTemplate, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountMenu } from '@/features/auth/AccountMenu'
import { useAuth } from '@/features/auth/AuthProvider'
import { CreateMenu } from '@/features/dashboard/CreateMenu'
import { deleteLocalDesign, listLocalDesigns, localRepository, type LocalDesignSummary } from '@/lib/local'
import { useStorageMode } from '@/lib/local/useStorageMode'
import { formatRelative } from '@/lib/time'
import { usePageMeta } from '@/lib/usePageMeta'
import { useBlobUrl } from '@/lib/useBlobUrl'
import { Badge, Button, ConfirmDialog, EmptyState, IconButton, LinkButton, Logo, Thumbnail, useToast } from '@/ui'
import styles from './StudioPage.module.css'

/**
 * `/studio`: the studio that is always open. The desktop app sends anonymous
 * and offline visitors here instead of a sign-in wall or a connection error,
 * because local (guest) designs live in the app's own storage and need no
 * server. The web site keeps its landing page; this page is reachable there
 * too, but is not part of the marketing flow.
 */
export default function StudioPage() {
  usePageMeta({ title: 'Your studio', noindex: true })
  const { status, user, bootstrapError, retryBootstrap } = useAuth()
  const storageMode = useStorageMode()
  const { toast } = useToast()
  const [designs, setDesigns] = useState<LocalDesignSummary[] | null>(null)
  const [pending, setPending] = useState<LocalDesignSummary | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDesigns(await listLocalDesigns())
    } catch {
      setDesigns([])
    }
  }, [])

  useEffect(() => {
    let active = true
    listLocalDesigns()
      .then((list) => active && setDesigns(list))
      .catch(() => active && setDesigns([]))
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    // The repository notifies when the backing store changes (e.g. storage became unavailable).
    const unsubscribe = localRepository.subscribe(onFocus)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      unsubscribe()
    }
  }, [refresh])

  const unreachable = bootstrapError !== null && bootstrapError.status !== 401

  async function remove(design: LocalDesignSummary) {
    try {
      await deleteLocalDesign(design.id)
      toast({ title: 'Design deleted', variant: 'success' })
    } catch {
      toast({ title: 'Couldn’t delete the design', description: 'Please try again.', variant: 'error' })
    }
    setPending(null)
    await refresh()
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to="/studio" className={styles.brand} aria-label="Studio Nova studio">
          <Logo height={28} />
          <span className={styles.crumb}>Your studio</span>
        </Link>
        <div className={styles.actions}>
          <LinkButton to="/templates" variant="ghost" size="sm" leftIcon={<LayoutTemplate size={16} />}>
            Templates
          </LinkButton>
          <CreateMenu />
          {user ? (
            <>
              <LinkButton to="/dashboard" variant="secondary" size="sm" leftIcon={<Cloud size={16} />}>
                Cloud studio
              </LinkButton>
              <AccountMenu />
            </>
          ) : unreachable ? (
            <Badge tone="neutral">
              <WifiOff size={13} aria-hidden="true" /> Local mode
            </Badge>
          ) : status !== 'loading' ? (
            <LinkButton to="/login?next=%2Fdashboard" variant="secondary" size="sm">
              Sign in
            </LinkButton>
          ) : null}
        </div>
      </header>

      <main id="main" tabIndex={-1} className={styles.main}>
        <div className={styles.intro}>
          <div className={styles.introText}>
            <p className={styles.eyebrow}>On this device</p>
            <h1 className={styles.title}>Your studio</h1>
            <p className={styles.lead}>Start something new, or pick up a design saved on this computer. No account and no connection needed.</p>
          </div>
        </div>

        {unreachable ? (
          <div className={styles.notice} role="status">
            <WifiOff size={20} aria-hidden="true" className={styles.noticeIcon} />
            <div className={styles.noticeText}>
              <strong>Working in local mode</strong>
              <p>
                Studio Nova’s local engine isn’t answering yet. Keep designing: everything on this page is saved on this computer. Accounts, sharing and AI
                come back once it is ready.
              </p>
            </div>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={15} />} loading={status === 'loading'} onClick={retryBootstrap}>
              Retry
            </Button>
          </div>
        ) : null}

        {storageMode === 'memory' ? (
          <div className={styles.notice} data-tone="warning" role="alert">
            <HardDrive size={20} aria-hidden="true" className={styles.noticeIcon} />
            <div className={styles.noticeText}>
              <strong>This device won’t keep your designs</strong>
              <p>Studio Nova can’t use the app’s storage here, so a design disappears when the window closes. Free up disk space and restart the app to keep them.</p>
            </div>
          </div>
        ) : null}

        {designs === null ? (
          <p className={styles.loading} role="status">
            Opening your designs…
          </p>
        ) : designs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={28} />}
            title="Your first design starts here"
            description="Designs are saved inside the app on this computer, so they are here next time — even without a connection."
            action={
              <>
                <LinkButton to="/create" size="lg">
                  Start a design
                </LinkButton>
                <LinkButton to="/templates" variant="secondary" size="lg">
                  Browse templates
                </LinkButton>
              </>
            }
          />
        ) : (
          <section aria-labelledby="local-designs">
            <div className={styles.sectionHeader}>
              <h2 id="local-designs">Designs on this device</h2>
              <span className={styles.count}>{designs.length}</span>
            </div>
            <ul className={styles.grid}>
              {designs.map((design) => (
                <LocalDesignCard key={design.id} design={design} onDelete={setPending} />
              ))}
            </ul>
          </section>
        )}

        <p className={styles.footnote}>
          <HardDrive size={15} aria-hidden="true" />
          Saved in this app, on this computer. Templates work offline; AI, stock photos and cloud sync need a connection.
        </p>
      </main>

      <ConfirmDialog
        open={pending !== null}
        title={`Delete “${pending?.title || 'Untitled design'}”?`}
        description="This design is stored only on this computer, so it can’t be recovered once deleted."
        confirmLabel="Delete design"
        tone="danger"
        onCancel={() => setPending(null)}
        onConfirm={() => (pending ? remove(pending) : undefined)}
      />
    </div>
  )
}

function LocalDesignCard({ design, onDelete }: { design: LocalDesignSummary; onDelete(design: LocalDesignSummary): void }) {
  const url = useBlobUrl(design.thumbnail)
  const title = design.title || 'Untitled design'
  return (
    <li className={styles.card}>
      <Link to={`/local/${design.id}`} className={styles.thumbLink} aria-hidden="true" tabIndex={-1}>
        <Thumbnail src={url} alt="" aspect={4 / 3} fit="contain" page={design} className={styles.thumb} />
      </Link>
      <div className={styles.info}>
        <Link to={`/local/${design.id}`} className={styles.cardTitle} title={title}>
          {title}
        </Link>
        <p className={styles.meta}>
          {design.width} × {design.height} · edited {formatRelative(design.updatedAt)}
        </p>
      </div>
      <div className={styles.delete}>
        <IconButton size="sm" variant="secondary" label={`Delete ${title}`} icon={<Trash2 size={15} />} onClick={() => onDelete(design)} />
      </div>
    </li>
  )
}
