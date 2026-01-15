import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CRM } from '../src/components/admin/CRM';
import userEvent from '@testing-library/user-event';

// Mock SWR
const mockUseSWR = vi.fn();
vi.mock('swr', () => ({
    default: (key: any, fetcher: any) => mockUseSWR(key, fetcher),
    useSWRConfig: () => ({ mutate: vi.fn() })
}));

describe('CRM Component', () => {
    const mockProps = {
        serverUrl: 'http://localhost:3000',
        getAuthHeaders: () => ({ 'Authorization': 'Bearer token' })
    };

    const mockContacts = {
        contacts: [
            {
                id: '1', name: 'John Doe', email: 'john@example.com', type: 'user',
                tags: ['vip'], isBlocked: false,
                stats: { totalSpend: 500, reliabilityScore: 90, totalVisits: 5 }
            }
        ],
        total: 1
    };

    const mockDetail = {
        profile: mockContacts.contacts[0],
        timeline: [],
        notes: 'Existing note'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default SWR response (loading state handling needs care)
        mockUseSWR.mockImplementation((key: string) => {
            if (key?.includes('/contacts?')) return { data: mockContacts, error: null };
            if (key?.includes('/contacts/1')) return { data: mockDetail, error: null };
            return { data: null, error: null };
        });
        global.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
        } as any));
        global.confirm = vi.fn(() => true); // Auto-confirm
        global.alert = vi.fn();
    });

    it('renders the contact list', () => {
        render(<CRM {...mockProps} />);
        expect(screen.getByText('Customer Relationship Management')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    it('switches to detail view on click', async () => {
        render(<CRM {...mockProps} />);
        const viewBtn = screen.getByText('View');
        fireEvent.click(viewBtn);

        await waitFor(() => {
            expect(screen.getByText('Unified Timeline')).toBeInTheDocument();
        });
        expect(screen.getByText('Life Time Value')).toBeInTheDocument();
    });

    it('opens broadcast modal', () => {
        render(<CRM {...mockProps} />);
        fireEvent.click(screen.getByText('📣 Broadcast'));
        expect(screen.getByText('📢 New Broadcast Campaign')).toBeInTheDocument();
    });

    it('filters contacts', () => {
        render(<CRM {...mockProps} />);
        const searchInput = screen.getByPlaceholderText('Search email or name...');
        fireEvent.change(searchInput, { target: { value: 'Jane' } });

        // SWR should be called with new query
        expect(mockUseSWR).toHaveBeenCalledWith(
            expect.stringContaining('search=Jane'),
            expect.any(Function)
        );
    });

    it('sends sync request', async () => {
        render(<CRM {...mockProps} />);
        const syncBtn = screen.getByText('🔄 Sync & Tag');
        fireEvent.click(syncBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/sync'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });
});
