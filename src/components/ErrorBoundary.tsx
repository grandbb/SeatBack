import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  failed: boolean
}

/** Keeps one broken view (for example an event with unreadable data) from blanking the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center flex flex-col gap-3">
        <p className="font-semibold text-[var(--ink)]">Something on this page could not be displayed</p>
        <p className="text-sm text-[var(--muted)]">Your funds are not affected. Reload the page or open another tab.</p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="mx-auto text-sm font-semibold text-[var(--accent)] underline"
        >
          Try again
        </button>
      </div>
    )
  }
}
