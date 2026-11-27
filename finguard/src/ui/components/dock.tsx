import type { ReactElement } from "react";

import { Icon } from "./icon";

/** Timeline view: follow the live edge, or fit the whole run so far. */
export function Dock({ follow, onFollow }: { follow: boolean; onFollow: (follow: boolean) => void }): ReactElement {
  return (
    <div className="dock">
      <div className="controls">
        <button className="key flat" aria-pressed={follow} onClick={() => onFollow(true)}><Icon name="target-02" />Follow live</button>
        <button className="key flat" aria-pressed={!follow} onClick={() => onFollow(false)}><Icon name="maximize-01" />Whole run</button>
      </div>
    </div>
  );
}
