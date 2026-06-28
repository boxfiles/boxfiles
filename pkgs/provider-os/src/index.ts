import { createPlugin } from "@boxfiles/plugin";
import { createOsContext } from "./facts";

export default createPlugin({
    id: "os",
    context: createOsContext(),
});
