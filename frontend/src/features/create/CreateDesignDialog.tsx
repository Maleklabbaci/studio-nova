import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUrl, describeSize, presetsByCategory } from '@/features/presets'
import { Dialog, EmptyState, Input, Tab, TabList, TabPanel, Tabs } from '@/ui'
import { CustomSizeForm } from './CustomSizeForm'
import styles from './CreateDesignDialog.module.css'

export interface CreateDesignDialogProps {
  open: boolean
  onClose(): void
  /** Which tab to show first. */
  initialTab?: 'sizes' | 'custom'
}

/** Pick a size preset (grouped like the usual design tools) or enter a custom size. */
export function CreateDesignDialog({ open, onClose, initialTab = 'sizes' }: CreateDesignDialogProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return presetsByCategory()
      .map((group) => ({ ...group, presets: group.presets.filter((preset) => !needle || preset.label.toLowerCase().includes(needle) || group.category.label.toLowerCase().includes(needle)) }))
      .filter((group) => group.presets.length > 0)
  }, [query])

  function go(url: string) {
    onClose()
    navigate(url)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create a design" description="Choose a size to start with. You can change it any time." size="xl">
      <Tabs defaultValue={initialTab}>
        <TabList label="Size source">
          <Tab value="sizes">Popular sizes</Tab>
          <Tab value="custom">Custom size</Tab>
        </TabList>
        <TabPanel value="sizes">
          <Input label="Search sizes" hideLabel placeholder="Search sizes, e.g. “poster”" leftIcon={<Search size={16} />} value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
          <div className={styles.groups}>
            {groups.length === 0 ? (
              <EmptyState compact title="No matching size" description="Try another word, or use the Custom size tab." />
            ) : (
              groups.map(({ category, presets }) => (
                <section key={category.id} aria-labelledby={`preset-group-${category.id}`}>
                  <h3 id={`preset-group-${category.id}`} className={styles.groupTitle}>
                    {category.label}
                  </h3>
                  <ul className={styles.grid}>
                    {presets.map((preset) => (
                      <li key={preset.id}>
                        <button type="button" className={styles.preset} onClick={() => go(createUrl({ presetId: preset.id }))}>
                          <span className={styles.icon} aria-hidden="true">
                            <preset.icon size={20} />
                          </span>
                          <span className={styles.text}>
                            <span className={styles.label}>{preset.label}</span>
                            <span className={styles.size}>{describeSize(preset)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </TabPanel>
        <TabPanel value="custom">
          <CustomSizeForm onSubmit={(size) => go(createUrl(size))} />
        </TabPanel>
      </Tabs>
    </Dialog>
  )
}
