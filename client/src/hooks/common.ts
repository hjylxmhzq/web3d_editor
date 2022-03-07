import { useState } from "react";

export function useUpdate() {

    const [_, setCount] = useState(0);

    return function refresh() {

        setCount((v) => v + 1);

    }

}