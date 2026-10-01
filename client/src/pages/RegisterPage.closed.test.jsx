import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage.jsx';

vi.mock('../features/auth/AuthContext.jsx', () => ({
  useAuth: () => ({
    register: vi.fn(),
    login: vi.fn(),
  }),
}));

vi.mock('../features/tenant/TenantContext.jsx', () => ({
  useTenant: () => ({
    tenantName: 'Closed U',
    logoUrl: '',
    tenantPath: (p) => p,
    signupMode: 'closed',
    allowedDomains: [],
  }),
}));

vi.mock('../api/taxonomy.js', () => ({
  getUniversities: vi.fn().mockResolvedValue({ data: { items: [] } }),
  getCampuses: vi.fn().mockResolvedValue({ data: { items: [] } }),
  getDepartments: vi.fn().mockResolvedValue({ data: { items: [] } }),
}));

describe('closed signup UI', () => {
  it('shows closed message and no create-account submit', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Registration closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create account/i })).toBeNull();
  });
});
