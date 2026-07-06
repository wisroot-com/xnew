import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        {/* <p className="hero__subtitle">{siteConfig.tagline}</p> */}
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/manual/getstarted">
            get start - 10min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      // title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <main>
        <div style={{textAlign: 'center', fontSize: '24px'}}>
          <img width="600" src ="/xnew/img/mascot.gif"/>
          <p><b>xnew</b> is a JavaScript / TypeScript library for component-oriented programming,<br/>
          providing a flexible architecture well-suited for applications with dynamic scenes and games.</p>
        </div>
        {/* <iframe style={{width:'100%',height:'400px'}} src="/xnew/examples/demo.html" ></iframe> */}

        {/* <HomepageFeatures /> */}
      </main>
    </Layout>
  );
}
