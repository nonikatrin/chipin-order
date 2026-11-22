import React from 'react';
import brandImg from '../assets/branding/chipin-order-lockup-4k.avif'; // Use smaller AVIF derivative

interface SplashOverlayProps {
  fadeOut: boolean;
}

export default function SplashOverlay({ fadeOut }: SplashOverlayProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FCF9F2', // Cream background color base
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'opacity 0.4s ease-in-out',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: 'none',
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      {/* Brand Image Layer Wrapper (No transform or isolation groups to prevent blend breaking) */}
      <div style={{ maxWidth: '280px', width: '80%', marginBottom: '1rem' }}>
        <img
          src={brandImg}
          alt="Chip!n Order Logo"
          style={{
            width: '100%',
            height: 'auto',
            mixBlendMode: 'multiply', // Kills white background on cream
          }}
        />
      </div>

      {/* Brand Typography Text Accent */}
      <h1
        style={{
          fontSize: 'var(--fs-splash)', // ExtraBold 800 · 36px Spec
          fontWeight: 800,
          color: 'var(--po-orange)', // #F4722B Brand Identifier
          margin: 0,
          letterSpacing: '-0.03em',
        }}
      >
        Chip!n Order
      </h1>
    </div>
  );
}