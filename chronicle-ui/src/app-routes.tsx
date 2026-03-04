import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { APP_ROUTES } from "./config/routes";

export function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      {APP_ROUTES.map((item) => (
        <Route key={item.path} path={item.path} element={item.element} />
      ))}
      <Route
        path="*"
        element={
          <Navigate
            to={{
              pathname: APP_ROUTES[0].path,
              search: location.search
            }}
            replace
          />
        }
      />
    </Routes>
  );
}
