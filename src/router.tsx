import { QueryClient } from "@tanstack/react-query";
import { createRouter, NotFoundRoute } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Route as rootRoute } from "./routes/__root";
import { NotFoundPage } from "./components/NotFoundPage";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const notFoundRoute = new NotFoundRoute({
    getParentRoute: () => rootRoute,
    component: NotFoundPage,
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    notFoundRoute,
  });

  return router;
};
