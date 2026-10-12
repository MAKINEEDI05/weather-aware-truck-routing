import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { StateView } from '../components/StateViews'
import { TopBar } from '../components/TopBar'
import { buttonClass } from '../lib/ui'

export function NotFoundPage() {
  return (
    <>
      <TopBar title="Page not found" />
      <div className="p-4 lg:p-6">
        <StateView
          icon={SearchX}
          title="This page does not exist"
          actions={
            <Link to="/plan" className={buttonClass('primary')}>
              Plan a trip
            </Link>
          }
        >
          Check the address, or start by planning a trip.
        </StateView>
      </div>
    </>
  )
}
