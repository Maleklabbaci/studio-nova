import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EditorProblemPage, EditorSkeleton } from '@/features/editor/EditorStates'
import { useAuth } from '@/features/auth/AuthProvider'
import { resolveCreateSpec, type CreateSpec, type TemplateSpec } from '@/features/presets'
import { designsApi, templatesApi } from '@/lib/api'
import { createBlankDocument } from '@/lib/document'
import { loadStaticTemplate } from '@/lib/staticTemplates'
import { createLocalDesign } from '@/lib/local'
import { usePageMeta } from '@/lib/usePageMeta'
import { LocalStorageFullError } from '@/lib/local'
import { EmptyState, Button } from '@/ui'
import { TriangleAlert } from 'lucide-react'

/**
 * `/create`: makes a new design from the query string and replaces itself with the editor route.
 * Guests get a local design (`/local/:id`); signed-in users get a real one (`/design/:id`).
 */
export default function CreatePage() {
  usePageMeta({ title: 'Creating your design', noindex: true })
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { status } = useAuth()
  const started = useRef(false)
  const [failure, setFailure] = useState<'template-missing' | 'storage-full' | 'error' | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (status === 'loading' || started.current) return
    started.current = true
    const spec = resolveCreateSpec(params)
    void (async () => {
      try {
        const target = status === 'authenticated' ? await createAccountDesign(spec) : await createGuestDesign(spec)
        navigate(target, { replace: true })
      } catch (error) {
        started.current = false
        if (error instanceof LocalStorageFullError) setFailure('storage-full')
        else if (spec.kind === 'template' && isNotFound(error)) setFailure('template-missing')
        else setFailure('error')
      }
    })()
  }, [status, params, navigate, attempt])

  if (failure === 'template-missing') {
    return <EditorProblemPage problem="not-found" extraAction={<Button variant="secondary" onClick={() => navigate('/templates')}>Browse templates</Button>} />
  }
  if (failure === 'storage-full') {
    return (
      <EmptyState
        icon={<TriangleAlert size={28} />}
        title="Your browser is out of space"
        description="Studio Nova couldn’t store a new design here. Free up some space, or sign up to keep designs in your account instead."
        role="alert"
        action={<Button onClick={() => navigate('/signup')}>Create a free account</Button>}
      />
    )
  }
  if (failure === 'error') {
    return (
      <EditorProblemPage
        problem="error"
        onRetry={() => {
          setFailure(null)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }
  return <EditorSkeleton label="Setting up your canvas" />
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 404
}

async function createGuestDesign(spec: CreateSpec | TemplateSpec): Promise<string> {
  if (spec.kind === 'template') {
    // With a backend the API serves the template; on static deployments the
    // catalogue shipped with the site build does, so templates open anywhere.
    const fromApi = await templatesApi.get(spec.slug).catch(() => null)
    const fromStatic = fromApi ? null : await loadStaticTemplate(spec.slug)
    if (!fromApi && !fromStatic) throw Object.assign(new Error(`Template "${spec.slug}" was not found.`), { status: 404 })
    const title = fromApi?.title ?? fromStatic?.title ?? spec.slug
    const source = fromApi ?? fromStatic
    if (!source) throw Object.assign(new Error(`Template "${spec.slug}" was not found.`), { status: 404 })
    const document = { ...source.document, meta: { ...source.document.meta, presetId: source.document.meta?.presetId ?? (source.preset || undefined) } }
    const local = await createLocalDesign({ title, document })
    return `/local/${local.id}`
  }
  const local = await createLocalDesign({ title: spec.title, document: createBlankDocument(spec.width, spec.height, { unit: spec.unit, presetId: spec.presetId }) })
  return `/local/${local.id}`
}

async function createAccountDesign(spec: CreateSpec | TemplateSpec): Promise<string> {
  if (spec.kind === 'template') {
    const design = await templatesApi.use(spec.slug)
    return `/design/${design.id}`
  }
  const design = await designsApi.create({ title: spec.title, width: spec.width, height: spec.height, preset: spec.presetId, document: createBlankDocument(spec.width, spec.height, { unit: spec.unit, presetId: spec.presetId }) })
  return `/design/${design.id}`
}
