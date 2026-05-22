'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './site-shell.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Home', hint: 'Overview' },
  { href: '/agents', label: 'Agents', hint: 'Approved' },
  { href: '/workflows', label: 'Workflows', hint: 'Curated' },
  { href: '/schedule', label: 'Schedule', hint: 'Cron' },
  { href: '/credentials', label: 'Identity', hint: 'OAuth' },
  { href: '/billing', label: 'Billing', hint: 'Upgrade' },
  { href: '/runs', label: 'Runs', hint: 'History' },
];

import { SetupBanner } from './setup-banner';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={`${styles.shell} paw-bg`}>
      <SetupBanner isSetup={false} />
      <header className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <img src="/assets/logo.png" alt="Meooww Logo" className={styles.brandMark} style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
          <span className={styles.brandName}>Meooww</span>
        </Link>

        <nav className={styles.nav}>
          <Link href="/agents" className={`${styles.navLink} ${pathname === '/agents' ? styles.navLinkActive : ''}`}>
            <span className={styles.navLabel}>Free Agents</span>
          </Link>
          <Link href="/workflows" className={`${styles.navLink} ${pathname === '/workflows' ? styles.navLinkActive : ''}`}>
            <span className={styles.navLabel}>AI Flows</span>
          </Link>
          <Link href="/tools" className={`${styles.navLink} ${pathname === '/tools' ? styles.navLinkActive : ''}`}>
            <span className={styles.navLabel}>Tools</span>
          </Link>
          <Link href="/billing" className={`${styles.navLink} ${pathname === '/billing' ? styles.navLinkActive : ''}`}>
            <span className={styles.navLabel}>Pro</span>
          </Link>
        </nav>

        <div className={styles.nav} style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          <Link href="/privacy" className={styles.navLink} style={{ padding: '8px 16px', opacity: 0.6 }}>
            <span className={styles.navLabel} style={{ fontSize: '12px' }}>Privacy Policy</span>
          </Link>
          <Link href="/terms" className={styles.navLink} style={{ padding: '8px 16px', opacity: 0.6 }}>
            <span className={styles.navLabel} style={{ fontSize: '12px' }}>Terms of Service</span>
          </Link>
        </div>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
