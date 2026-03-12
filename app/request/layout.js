export default function RequestLayout({ children }) {
    return (
        <div style={{
            minHeight: '100vh',
            background: '#0d1117',
            color: '#c9d1d9',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        }}>
            {children}
        </div>
    );
}
