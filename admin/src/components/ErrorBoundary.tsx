import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Beklenmeyen bir render hatasında panelin tamamının boş kalmasını önler;
 * hatayı kart içinde gösterir ve sayfayı yeniden yüklemeyi önerir.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Gerçek ortamda buradan hata toplama servisine gönderilir.
    console.error('Panelde beklenmeyen hata:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="card" role="alert" style={{ margin: 24 }}>
        <h2 style={{ color: 'var(--c-danger)' }}>Beklenmeyen bir hata oluştu</h2>
        <p className="muted small">{error.message}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Sayfayı yeniden yükle
        </button>
      </div>
    );
  }
}
