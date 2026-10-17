import { DangerSection } from '@/features/settings/DangerSection'
import { EmailSection } from '@/features/settings/EmailSection'
import { PasswordSection } from '@/features/settings/PasswordSection'
import { ProfileSection } from '@/features/settings/ProfileSection'
import { usePageTitle } from '@/lib/usePageTitle'
import styles from './pageStyles.module.css'
import settingsStyles from './SettingsPage.module.css'

export default function SettingsPage() {
  usePageTitle('Settings')
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.lead}>Manage your profile, email and security.</p>
      </header>
      <div className={settingsStyles.stack}>
        <ProfileSection />
        <EmailSection />
        <PasswordSection />
        <DangerSection />
      </div>
    </div>
  )
}
