import Link from 'next/link';
import styles from './setup-banner.module.css';

export function SetupBanner({ isSetup = false }) {
  if (isSetup) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.container}>
        <span className={styles.icon}>⚠️</span>
        <div className={styles.content}>
          <span className={styles.title}>Account not fully set up</span>
          <span className={styles.text}>Connect your API providers to start deploying Free Agents.</span>
        </div>
        <Link href="/settings" className={styles.action}>
          Complete Setup →
        </Link>
      </div>
    </div>
  );
}
