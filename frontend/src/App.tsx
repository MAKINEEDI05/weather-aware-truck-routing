import { Route, Routes } from 'react-router'
import type { PlanResponse } from './api/types'
import type { TripDraft } from './features/trip-form/validation'
import { AppLayout } from './layouts/AppLayout'
import { AboutPage } from './pages/AboutPage'
import { HeatmapPage } from './pages/HeatmapPage'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlanPage } from './pages/PlanPage'
import { RecommendationPage } from './pages/RecommendationPage'
import { RouteDetailsPage } from './pages/RouteDetailsPage'
import { RoutesPage } from './pages/RoutesPage'
import { TripProvider } from './state/TripContext'

interface AppProps {
  /** Test hooks: start with an existing plan and/or form draft. */
  initialResult?: PlanResponse
  initialDraft?: TripDraft
}

/** Routes (DEC-29). Wrap in a router: BrowserRouter in main.tsx, MemoryRouter in tests. */
export default function App({ initialResult, initialDraft }: AppProps) {
  return (
    <TripProvider initialResult={initialResult} initialDraft={initialDraft}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppLayout />}>
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/routes/:routeId" element={<RouteDetailsPage />} />
          <Route path="/recommendation" element={<RecommendationPage />} />
          <Route path="/heatmap" element={<HeatmapPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </TripProvider>
  )
}
