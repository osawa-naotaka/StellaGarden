import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import App from "./App";
import { BaseLayout } from "./BaseLayout";
import { GameLayout } from "./GameLayout";

const router = createBrowserRouter([
    {
        element: <BaseLayout />,
        children: [
            {
                element: <GameLayout />,
                children: [
                    {
                        path: "/",
                        Component: App,
                    },
                ],
            },
        ],
    },
]);

const root = document.getElementById("root");
if (root === null) {
    throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
