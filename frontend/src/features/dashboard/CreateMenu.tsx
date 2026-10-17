import { Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateDesignDialog } from '@/features/create/CreateDesignDialog'
import { createUrl, getPreset, QUICK_PRESET_IDS } from '@/features/presets'
import { Button, IconButton, Menu, MenuItem, MenuLabel, MenuSeparator, useMediaQuery } from '@/ui'

/** "Create a design" dropdown: quick presets plus the full size picker. */
export function CreateMenu() {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'sizes' | 'custom' | null>(null)
  const compact = useMediaQuery('(max-width: 639px)')
  return (
    <>
      <Menu label="Create a design" placement="bottom-end" trigger={compact ? <IconButton variant="primary" label="Create a design" icon={<Plus size={20} />} /> : <Button leftIcon={<Plus size={18} />}>Create a design</Button>}>
        <MenuLabel>Popular sizes</MenuLabel>
        {QUICK_PRESET_IDS.map((id) => {
          const preset = getPreset(id)
          if (!preset) return null
          return (
            <MenuItem key={id} icon={<preset.icon size={16} />} onSelect={() => navigate(createUrl({ presetId: id }))}>
              {preset.label}
            </MenuItem>
          )
        })}
        <MenuSeparator />
        <MenuItem icon={<SlidersHorizontal size={16} />} onSelect={() => setDialog('custom')}>
          Custom size…
        </MenuItem>
        <MenuItem onSelect={() => setDialog('sizes')}>More sizes…</MenuItem>
      </Menu>
      <CreateDesignDialog open={dialog !== null} onClose={() => setDialog(null)} initialTab={dialog === 'custom' ? 'custom' : 'sizes'} />
    </>
  )
}
