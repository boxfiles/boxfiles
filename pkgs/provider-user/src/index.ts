import { createPlugin } from "@boxfiles/plugin";
import { createUserContext } from "./facts";

export default createPlugin({
    id: "user",
    context: createUserContext(),
});
