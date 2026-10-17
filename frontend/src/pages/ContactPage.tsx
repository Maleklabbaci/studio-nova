import { Mail } from 'lucide-react'
import { Accent, PageIntro } from '@/features/marketing/PageIntro'
import { usePageMeta } from '@/lib/usePageMeta'
import styles from './ContactPage.module.css'

export default function ContactPage() {
  usePageMeta({
    title: 'Contact',
    description: 'Contact details and support channels for Studio Nova.',
    canonical: '/contact',
  })

  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="say hello"
        title={
          <>
            We’d <Accent>love</Accent> to hear from you.
          </>
        }
        lead="Studio Nova support channels are being set up. Contact details will be published here soon."
        bubble="coming soon!"
      />

      <section className={styles.contact} aria-labelledby="contact-title">
        <span className={styles.icon} aria-hidden="true">
          <Mail size={24} strokeWidth={2} />
        </span>
        <p className={styles.hand}>we’re getting things ready</p>
        <h2 id="contact-title" className={styles.title}>
          Contact details are on their way.
        </h2>
        <p className={styles.description}>
          We’re preparing a direct way to reach the Studio Nova team. Please check back for updates.
        </p>
      </section>
    </div>
  )
}
