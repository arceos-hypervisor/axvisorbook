import React from "react";
import clsx from "clsx";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import styles from './styles.module.css';

// <TabsArch list={FeatureList}/>
export default function TabsArch(props) {
  return (
    <div>
      <Tabs className={styles.tabs}>
        {props.list.map((em, idx) => (
          <TabItem key={idx} className={clsx("text--center")} value={em.title} label={em.title}>
            <div className={styles.tabrowdisplay}>
              <img src={useBaseUrl(em.svg)} alt={em.alt} className={styles.tabimages} />
              <p className={styles.tabtextdisplay}> {em.description} </p>
            </div>
          </TabItem>
        ))}
      </Tabs>
    </div>
  );
}

