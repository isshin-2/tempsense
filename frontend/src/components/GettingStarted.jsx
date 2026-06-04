import { Building2, DoorOpen, Cpu, ArrowRight, Thermometer, BarChart3, Bell, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    num: 1,
    title: 'Create a Site',
    desc: 'Add your first facility or warehouse location.',
    icon: <Building2 size={22} />,
    path: '/sites',
    color: '#3b82f6',
  },
  {
    num: 2,
    title: 'Add Rooms',
    desc: 'Define cold storage zones within your site.',
    icon: <DoorOpen size={22} />,
    path: '/rooms',
    color: '#06b6d4',
  },
  {
    num: 3,
    title: 'Register Nodes',
    desc: 'Connect your TEMPSENSE sensor hardware.',
    icon: <Cpu size={22} />,
    path: '/nodes',
    color: '#10b981',
  },
];

const features = [
  { icon: <Thermometer size={18} />, label: 'Real-time Monitoring', color: '#3b82f6' },
  { icon: <Bell size={18} />, label: 'Smart Alerts', color: '#f59e0b' },
  { icon: <BarChart3 size={18} />, label: 'PDF & CSV Reports', color: '#8b5cf6' },
  { icon: <Users size={18} />, label: 'Role-based Access', color: '#10b981' },
];

export default function GettingStarted() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 0' }}>
      {/* Welcome header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'rgba(59, 130, 246, 0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Thermometer size={36} style={{ color: '#3b82f6' }} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Welcome to TEMPSENSE
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6 }}>
          Your cold chain monitoring platform is ready. Follow these steps to start tracking sensor data.
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
        {steps.map((step) => (
          <button
            key={step.num}
            onClick={() => navigate(step.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '20px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              width: '100%',
              color: 'inherit',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = step.color;
              e.currentTarget.style.transform = 'translateX(4px)';
              e.currentTarget.style.boxShadow = `0 0 20px ${step.color}20`;
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: `${step.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: step.color, fontWeight: 800, fontSize: '14px',
              flexShrink: 0,
            }}>
              {step.num}
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: `${step.color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: step.color, flexShrink: 0,
            }}>
              {step.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                {step.title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {step.desc}
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* Feature chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px',
        padding: '24px', background: 'var(--bg-card)', borderRadius: '14px',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ width: '100%', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Platform Features
        </div>
        {features.map((f, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '20px',
            background: `${f.color}10`, color: f.color,
            fontSize: '12px', fontWeight: 600,
          }}>
            {f.icon} {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}
