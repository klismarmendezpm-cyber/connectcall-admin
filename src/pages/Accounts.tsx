import React, { useEffect, useState } from 'react';
import {
  Plus,
  KeyRound,
  Edit2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download } from
'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchInput } from '../components/ui/SearchInput';
import { FilterSelect } from '../components/ui/FilterSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { logAudit } from '../lib/auditLogger';
import { formatOrgName } from '../lib/displayNames';
import { toast } from 'sonner';
interface Account {
  account_id: number;
  person_id: number;
  system_id: number;
  username: string;
  display_label: string;
  ext_number: string;
  phone_line: string;
  pin_code: string;
  status: 'active' | 'disabled' | 'archived';
  is_shared: boolean;
  created_at: string;
  people?: {
    full_name: string;
    org_id?: number;
    assigned_org_ids?: number[];
    orgs?: {
      name: string;
    };
  };
  systems?: {
    system_name: string;
    org_id?: number;
    orgs?: {
      name: string;
    };
  };
}
export const Accounts = () => {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission(['admin', 'manager']);
  const isReadonly = user?.role_name === 'readonly';
  const scopedOrgIds = user?.assigned_org_ids?.length ?
  user.assigned_org_ids :
  user?.role_name === 'admin' ?
  null :
  user?.org_id ?
  [user.org_id] :
  [];
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [orgs, setOrgs] = useState<
    {
      id: number;
      name: string;
    }[]>(
    []);
  const [systems, setSystems] = useState<
    {
      id: number;
      name: string;
      org_id: number;
    }[]>(
    []);
  const [people, setPeople] = useState<
    {
      id: number;
      name: string;
      org_id: number;
      assigned_org_ids?: number[];
    }[]>(
    []);
  const [isLoading, setIsLoading] = useState(true);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [currentPage, setCurrentPage] = useState(1);
  const accountsPerPage = 6;
  // Reveal state
  const [revealedPins, setRevealedPins] = useState<Record<number, boolean>>({});
  const [revealConfirmOpen, setRevealConfirmOpen] = useState(false);
  const [accountToReveal, setAccountToReveal] = useState<Account | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<Partial<Account>>({
    status: 'active',
    is_shared: false
  });
  const [currentOrgId, setCurrentOrgId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const normalizeText = (value?: string | null) =>
      (value || '').trim().toLocaleLowerCase();
      const { data: orgData } = await supabase.
      from('orgs').
      select('id:org_id, name').
      order('name');
      // Fetch systems for filter
      const { data: sysData } = await supabase.
      from('systems').
      select('id:system_id, system_name, org_id').
      order('system_name');
      const { data: peopleData } = await supabase.
      from('people').
      select('id:person_id, full_name, org_id').
      order('full_name');
      const { data: assignmentData, error: assignmentError } = await supabase.
      from('person_org_assignments').
      select('person_id, org_id');
      if (assignmentError) {
        console.warn('Additional organization assignments are not available:', assignmentError.message);
      }
      const assignmentMap = new Map<number, number[]>();
      (assignmentData || []).forEach((assignment: any) => {
        const current = assignmentMap.get(assignment.person_id) || [];
        current.push(Number(assignment.org_id));
        assignmentMap.set(assignment.person_id, current);
      });
      const mappedPeople = (peopleData || []).map((p) => ({
          id: p.id,
          name: p.full_name,
          org_id: p.org_id,
          assigned_org_ids: assignmentMap.get(p.id) || []
        }));
      const scopedPeople = scopedOrgIds ?
      mappedPeople.filter(
        (person) =>
        scopedOrgIds.includes(Number(person.org_id)) ||
        person.assigned_org_ids.some((orgId) => scopedOrgIds.includes(orgId))
      ) :
      mappedPeople;
      const readonlyPerson = isReadonly && !scopedOrgIds ?
      mappedPeople.find(
        (person) =>
        normalizeText(person.name) === normalizeText(user?.full_name) ||
        normalizeText(person.name) === normalizeText(user?.username)
      ) :
      null;

      const visiblePeople = scopedOrgIds ?
      scopedPeople :
      isReadonly && readonlyPerson ?
      [readonlyPerson] :
      isReadonly ?
      [] :
      mappedPeople;
      const visibleOrgIds = new Set(
        visiblePeople.flatMap((person) => [
          person.org_id,
          ...(person.assigned_org_ids || [])
        ])
      );
      const mappedSystems = (sysData || []).map((s) => ({
        id: s.id,
        name: s.system_name,
        org_id: s.org_id
      }));

      setPeople(visiblePeople);
      setSystems(
        scopedOrgIds || isReadonly ?
        mappedSystems.filter((system) =>
          scopedOrgIds ?
          scopedOrgIds.includes(Number(system.org_id)) :
          visibleOrgIds.has(system.org_id)
        ) :
        mappedSystems
      );
      setOrgs(
        (scopedOrgIds || isReadonly ?
        (orgData || []).filter((org) =>
          scopedOrgIds ?
          scopedOrgIds.includes(Number(org.id)) :
          visibleOrgIds.has(org.id)
        ) :
        orgData || []).map((org) => ({ ...org, name: formatOrgName(org.name) }))
      );
      // Fetch accounts with joins
      let accountsQuery = supabase.
      from('accounts').
      select(
        `
          account_id,
          person_id,
          system_id,
          username,
          display_label,
          ext_number,
          phone_line,
          pin_code,
          status,
          is_shared,
          created_at,
          people (full_name, org_id, orgs (name)),
          systems (system_name, org_id, orgs (name))
        `
      ).
      order('display_label');
      if (isReadonly && !scopedOrgIds) {
        if (!readonlyPerson) {
          setAccounts([]);
          return;
        }
        accountsQuery = accountsQuery.eq('person_id', readonlyPerson.id);
      }
      const { data: accountsData, error } = await accountsQuery;
      if (error) throw error;
      if (accountsData && accountsData.length > 0) {
        const mappedAccounts = accountsData.map((account: any) => ({
          ...account,
          is_shared: account.is_shared === true || account.is_shared === 1,
          people: account.people ?
          {
            ...account.people,
            orgs: account.people.orgs ?
            { ...account.people.orgs, name: formatOrgName(account.people.orgs.name) } :
            account.people.orgs,
            assigned_org_ids: assignmentMap.get(account.person_id) || []
          } :
          account.people,
          systems: account.systems ?
          {
            ...account.systems,
            orgs: account.systems.orgs ?
            { ...account.systems.orgs, name: formatOrgName(account.systems.orgs.name) } :
            account.systems.orgs
          } :
          account.systems
        })) as Account[];
        setAccounts(
          mappedAccounts.filter(
            (account) =>
            !scopedOrgIds ||
            (
              (
                scopedOrgIds.includes(Number(account.people?.org_id)) ||
                (account.people?.assigned_org_ids || []).some((orgId) =>
                  scopedOrgIds.includes(orgId)
                )
              ) &&
              scopedOrgIds.includes(Number(account.systems?.org_id))
            )
          )
        );
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [user?.id, user?.role_name, user?.org_id, user?.assigned_org_ids?.join(',')]);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orgFilter, systemFilter, statusFilter]);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
    !currentAccount.person_id ||
    !currentAccount.system_id ||
    !currentAccount.username)
    return;
    if (
    scopedOrgIds &&
    (
    !people.some((person) => person.id === Number(currentAccount.person_id)) ||
    !systems.some((system) => system.id === Number(currentAccount.system_id))
    ))
    {
      toast.error('You can only manage accounts from your assigned organizations');
      return;
    }

    setIsSubmitting(true);
    try {
      const isNew = !currentAccount.account_id;
      const accountData = {
        person_id: Number(currentAccount.person_id),
        system_id: Number(currentAccount.system_id),
        username: currentAccount.username,
        display_label: currentAccount.display_label || null,
        ext_number: currentAccount.ext_number || null,
        phone_line: currentAccount.phone_line || null,
        pin_code: currentAccount.pin_code || null,
        status: currentAccount.status || 'active',
        is_shared: currentAccount.is_shared ? 1 : 0,
        updated_at: new Date().toISOString()
      };

      let savedAccount;
      if (isNew) {
        const { data, error } = await supabase.
        from('accounts').
        insert([
        {
          ...accountData,
          created_at: new Date().toISOString()
        }]
        ).
        select(
          'account_id, person_id, system_id, username, display_label, ext_number, phone_line, pin_code, status, is_shared, created_at, people(full_name, org_id, orgs(name)), systems(system_name, org_id, orgs(name))'
        ).
        single();
        if (error) throw error;
        savedAccount = data;
        toast.success('Credential created successfully');
      } else {
        const { data, error } = await supabase.
        from('accounts').
        update(accountData).
        eq('account_id', currentAccount.account_id).
        select(
          'account_id, person_id, system_id, username, display_label, ext_number, phone_line, pin_code, status, is_shared, created_at, people(full_name, org_id, orgs(name)), systems(system_name, org_id, orgs(name))'
        ).
        single();
        if (error) throw error;
        savedAccount = data;
        toast.success('Credential updated successfully');
      }

      await logAudit({
        actor: user?.username || 'unknown',
        action: isNew ? 'create' : 'update',
        entity: 'accounts',
        entity_id: savedAccount?.account_id || currentAccount.account_id,
        metadata: {
          username: accountData.username,
          system_id: accountData.system_id
        }
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving credential:', error);
      toast.error('Failed to save credential');
    } finally {
      setIsSubmitting(false);
    }
  };
  const toggleAccountStatus = async (account: Account) => {
    const nextStatus = account.status === 'active' ? 'disabled' : 'active';
    try {
      const { error } = await supabase.
      from('accounts').
      update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      }).
      eq('account_id', account.account_id);
      if (error) throw error;
      await logAudit({
        actor: user?.username || 'unknown',
        action: nextStatus === 'active' ? 'update' : 'disable',
        entity: 'accounts',
        entity_id: account.account_id,
        metadata: {
          status: nextStatus
        }
      });
      toast.success(`Credential ${nextStatus === 'active' ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      console.error('Error updating credential status:', error);
      toast.error('Failed to update credential status');
    }
  };
  const handleRevealRequest = (account: Account) => {
    if (revealedPins[account.account_id]) {
      // Hide it
      setRevealedPins((prev) => ({
        ...prev,
        [account.account_id]: false
      }));
    } else {
      // Request reveal
      setAccountToReveal(account);
      setRevealConfirmOpen(true);
    }
  };
  const confirmReveal = async () => {
    if (!accountToReveal) return;
    try {
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'view',
        entity: 'accounts',
        entity_id: accountToReveal.account_id,
        metadata: {
          field: 'pin_code',
          display_label: accountToReveal.display_label
        }
      });
      setRevealedPins((prev) => ({
        ...prev,
        [accountToReveal.account_id]: true
      }));
      toast.success('Credential revealed and logged');
    } catch (error) {
      console.error('Error logging reveal:', error);
      // Prototype fallback
      setRevealedPins((prev) => ({
        ...prev,
        [accountToReveal.account_id]: true
      }));
      toast.success('Credential revealed (Prototype mode)');
    } finally {
      setRevealConfirmOpen(false);
      setAccountToReveal(null);
    }
  };
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };
  const escapeExcelValue = (value: unknown) =>
  String(value ?? '').
  replace(/&/g, '&amp;').
  replace(/</g, '&lt;').
  replace(/>/g, '&gt;').
  replace(/"/g, '&quot;').
  replace(/'/g, '&#39;');
  const formatReportDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };
  const getFilterLabel = (
  value: string,
  options: {
    value: string;
    label: string;
  }[],
  fallback: string
  ) => options.find((option) => option.value === value)?.label || fallback;
  const exportAccountsReport = async () => {
    if (filteredAccounts.length === 0) {
      toast.error('No credentials available to export');
      return;
    }

    const orgLabel = getFilterLabel(
      orgFilter,
      orgs.map((org) => ({
        label: org.name,
        value: org.id.toString()
      })),
      'All organizations'
    );
    const systemLabel = getFilterLabel(
      systemFilter,
      systems.map((system) => ({
        label: system.name,
        value: system.id.toString()
      })),
      'All systems'
    );
    const statusLabel = statusFilter || 'All statuses';
    const generatedAt = new Date();
    const activeCount = filteredAccounts.filter((account) => account.status === 'active').length;
    const disabledCount = filteredAccounts.filter((account) => account.status === 'disabled').length;
    const archivedCount = filteredAccounts.filter((account) => account.status === 'archived').length;
    const sharedCount = filteredAccounts.filter((account) => account.is_shared).length;
    const rows = filteredAccounts.map((account, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeExcelValue(account.display_label || 'Unnamed Credential')}</td>
        <td>${escapeExcelValue(account.username || '')}</td>
        <td>${escapeExcelValue(account.people?.full_name || 'Unassigned')}</td>
        <td>${escapeExcelValue(account.systems?.system_name || 'Unknown')}</td>
        <td>${escapeExcelValue(formatOrgName(account.systems?.orgs?.name || account.people?.orgs?.name) || 'Unknown')}</td>
        <td>${escapeExcelValue(account.ext_number || '')}</td>
        <td>${escapeExcelValue(account.phone_line || '')}</td>
        <td class="status status-${escapeExcelValue(account.status)}">${escapeExcelValue(account.status.toUpperCase())}</td>
        <td class="center">${account.is_shared ? 'Yes' : 'No'}</td>
        <td class="center">${account.pin_code ? 'Stored' : 'Empty'}</td>
        <td>${escapeExcelValue(formatReportDate(account.created_at))}</td>
      </tr>`
    ).join('');
    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Accounts Report</x:Name>
                <x:WorksheetOptions>
                  <x:FreezePanes />
                  <x:FrozenNoSplit />
                  <x:SplitHorizontal>8</x:SplitHorizontal>
                  <x:TopRowBottomPane>8</x:TopRowBottomPane>
                  <x:ActivePane>2</x:ActivePane>
                  <x:DisplayGridlines>False</x:DisplayGridlines>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #0f172a; }
          table { border-collapse: collapse; width: 100%; }
          .title { background: #0b2a4a; color: #ffffff; font-size: 22px; font-weight: 700; height: 38px; text-align: center; vertical-align: middle; }
          .subtitle { background: #e0f2fe; color: #075985; font-weight: 600; text-align: center; vertical-align: middle; }
          .meta-label { background: #f1f5f9; color: #475569; font-weight: 700; }
          .meta-value { background: #ffffff; color: #0f172a; }
          .summary-label { background: #0f172a; color: #ffffff; font-weight: 700; text-align: center; }
          .summary-value { background: #f8fafc; color: #0f172a; font-size: 16px; font-weight: 700; text-align: center; }
          th { background: #0b2a4a; color: #ffffff; border: 1px solid #1e3a5f; font-weight: 700; text-align: center; height: 28px; }
          td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: middle; }
          .center { text-align: center; }
          .status { font-weight: 700; text-align: center; }
          .status-active { background: #dcfce7; color: #166534; }
          .status-disabled { background: #fee2e2; color: #991b1b; }
          .status-archived { background: #e2e8f0; color: #334155; }
          .note { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <table>
          <tr><td class="title" colspan="12">Accounts & Credentials Report</td></tr>
          <tr><td class="subtitle" colspan="12">ConnectCall Admin - Secure credential inventory</td></tr>
          <tr></tr>
          <tr>
            <td class="meta-label" colspan="2">Generated at</td>
            <td class="meta-value" colspan="4">${escapeExcelValue(generatedAt.toLocaleString())}</td>
            <td class="meta-label" colspan="2">Generated by</td>
            <td class="meta-value" colspan="4">${escapeExcelValue(user?.full_name || user?.username || 'Unknown')}</td>
          </tr>
          <tr>
            <td class="meta-label" colspan="2">Search</td>
            <td class="meta-value" colspan="4">${escapeExcelValue(searchQuery || 'No search filter')}</td>
            <td class="meta-label" colspan="2">Organization</td>
            <td class="meta-value" colspan="4">${escapeExcelValue(orgLabel)}</td>
          </tr>
          <tr>
            <td class="meta-label" colspan="2">System</td>
            <td class="meta-value" colspan="4">${escapeExcelValue(systemLabel)}</td>
            <td class="meta-label" colspan="2">Status</td>
            <td class="meta-value" colspan="4">${escapeExcelValue(statusLabel)}</td>
          </tr>
          <tr></tr>
          <tr>
            <td class="summary-label" colspan="2">Total</td>
            <td class="summary-label" colspan="2">Active</td>
            <td class="summary-label" colspan="2">Disabled</td>
            <td class="summary-label" colspan="2">Archived</td>
            <td class="summary-label" colspan="2">Shared</td>
            <td class="summary-label" colspan="2">Secrets</td>
          </tr>
          <tr>
            <td class="summary-value" colspan="2">${filteredAccounts.length}</td>
            <td class="summary-value" colspan="2">${activeCount}</td>
            <td class="summary-value" colspan="2">${disabledCount}</td>
            <td class="summary-value" colspan="2">${archivedCount}</td>
            <td class="summary-value" colspan="2">${sharedCount}</td>
            <td class="summary-value" colspan="2">Hidden</td>
          </tr>
          <tr><td class="note" colspan="12">Sensitive PIN/secret values are intentionally excluded from this report.</td></tr>
          <tr></tr>
          <tr>
            <th>#</th>
            <th>Credential</th>
            <th>Username</th>
            <th>Assigned To</th>
            <th>System</th>
            <th>Organization</th>
            <th>Extension</th>
            <th>Phone Line</th>
            <th>Status</th>
            <th>Shared</th>
            <th>Secret</th>
            <th>Created At</th>
          </tr>
          ${rows}
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([workbook], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const filenameDate = generatedAt.toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accounts-report-${filenameDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await logAudit({
      actor: user?.username || 'unknown',
      action: 'view',
      entity: 'accounts',
      entity_id: 0,
      metadata: {
        report: 'accounts_excel_export',
        exported_count: filteredAccounts.length,
        includes_pin_values: false,
        filters: {
          search: searchQuery || null,
          org: orgLabel,
          system: systemLabel,
          status: statusLabel
        }
      }
    });
    toast.success('Excel report downloaded');
  };
  const filteredAccounts = accounts.filter((account) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
    account.display_label?.toLowerCase().includes(searchLower) ||
    account.username?.toLowerCase().includes(searchLower) ||
    account.people?.full_name?.toLowerCase().includes(searchLower) ||
    account.ext_number?.toLowerCase().includes(searchLower);
    const matchesOrg = orgFilter ?
    account.systems?.org_id?.toString() === orgFilter ||
    account.people?.org_id?.toString() === orgFilter ||
    (account.people?.assigned_org_ids || []).some(
      (orgId) => orgId.toString() === orgFilter
    ) :
    true;
    const matchesSystem = systemFilter ?
    account.system_id.toString() === systemFilter :
    true;
    const matchesStatus = statusFilter ? account.status === statusFilter : true;
    return matchesSearch && matchesOrg && matchesSystem && matchesStatus;
  });
  const formPeople = currentOrgId ?
  people.filter(
    (person) =>
    person.org_id.toString() === currentOrgId ||
    (person.assigned_org_ids || []).some(
      (orgId) => orgId.toString() === currentOrgId
    ) ||
    person.id === currentAccount.person_id
  ) :
  people;
  const formSystems = currentOrgId ?
  systems.filter(
    (system) =>
    system.org_id.toString() === currentOrgId ||
    system.id === currentAccount.system_id
  ) :
  systems;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAccounts.length / accountsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * accountsPerPage;
  const paginatedAccounts = filteredAccounts.slice(
    pageStart,
    pageStart + accountsPerPage
  );
  const columns: Column<Account>[] = [
  {
    header: 'Credential',
    accessor: (row) =>
    <div>
          <div className="font-medium text-slate-900 flex items-center">
            {row.display_label || 'Unnamed Credential'}
            {row.is_shared &&
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                Shared
              </span>
        }
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center">
            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded mr-1 truncate max-w-[150px]">
              {row.username}
            </span>
            <button
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(row.username, `user-${row.account_id}`);
          }}
          className="text-slate-400 hover:text-brand-primary">
          
              {copiedId === `user-${row.account_id}` ?
          <Check className="w-3 h-3 text-green-500" /> :

          <Copy className="w-3 h-3" />
          }
            </button>
          </div>
        </div>,

    sortable: true,
    sortKey: 'display_label'
  },
  {
    header: 'System',
    accessor: (row) =>
    <div>
          <div className="text-sm text-slate-900">
            {row.systems?.system_name || 'Unknown'}
          </div>
          <div className="text-xs text-slate-500">
            {formatOrgName(row.systems?.orgs?.name) || 'Unknown Org'}
          </div>
        </div>

  },
  {
    header: 'Assigned To',
    accessor: (row) => row.people?.full_name || 'Unassigned'
  },
  {
    header: 'Secret (PIN)',
    accessor: (row) =>
    <div className="flex items-center space-x-2">
          <div className="font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded text-sm min-w-[80px] text-center">
            {revealedPins[row.account_id] ? row.pin_code : '••••••••'}
          </div>
          <button
        onClick={(e) => {
          e.stopPropagation();
          handleRevealRequest(row);
        }}
        className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-colors"
        title={revealedPins[row.account_id] ? 'Hide' : 'Reveal'}>
        
            {revealedPins[row.account_id] ?
        <EyeOff className="w-4 h-4" /> :

        <Eye className="w-4 h-4" />
        }
          </button>
          {revealedPins[row.account_id] &&
      <button
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(row.pin_code, `pin-${row.account_id}`);
        }}
        className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded transition-colors"
        title="Copy">
        
              {copiedId === `pin-${row.account_id}` ?
        <Check className="w-4 h-4 text-green-500" /> :

        <Copy className="w-4 h-4" />
        }
            </button>
      }
        </div>

  },
  {
    header: 'Status',
    accessor: (row) => <StatusBadge status={row.status} />
  }];

  if (canEdit) {
    columns.push({
      header: 'Actions',
      accessor: (row) =>
      <div className="flex items-center space-x-2">
          <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentAccount(row);
            setCurrentOrgId(
              row.systems?.org_id?.toString() ||
              row.people?.org_id?.toString() ||
              ''
            );
            setIsModalOpen(true);
          }}
          className="p-1 text-slate-400 hover:text-brand-primary transition-colors"
          title="Edit Details">
          
            <Edit2 className="w-4 h-4" />
          </button>
          <button
          onClick={(e) => {
            e.stopPropagation();
            toggleAccountStatus(row);
          }}
          className="p-1 text-slate-400 hover:text-brand-danger transition-colors"
          title={row.status === 'active' ? 'Disable' : 'Enable'}>
          
            <KeyRound className="w-4 h-4" />
          </button>
        </div>,

      className: 'text-right'
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Accounts & Credentials
          </h2>
          <p className="text-slate-500 mt-1">
            Securely manage access credentials
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
          type="button"
          onClick={exportAccountsReport}
          disabled={filteredAccounts.length === 0}
          className="btn-secondary flex items-center justify-center">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </button>
          {canEdit &&
        <button
          onClick={() => {
            setCurrentAccount({
              status: 'active',
              is_shared: false
            });
            setCurrentOrgId(orgFilter);
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Credential
          </button>
        }
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by label, username, or person..." />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={orgFilter}
              onChange={(value) => {
                setOrgFilter(value);
                setSystemFilter('');
              }}
              options={orgs.map((org) => ({
                label: org.name,
                value: org.id.toString()
              }))}
              placeholder="All Organizations" />
            
          </div>
          <div className="w-full md:w-48">
            <FilterSelect
              value={systemFilter}
              onChange={setSystemFilter}
              options={systems.
              filter((system) =>
              orgFilter ? system.org_id.toString() === orgFilter : true
              ).
              map((s) => ({
                label: s.name,
                value: s.id.toString()
              }))}
              placeholder="All Systems" />
            
          </div>
          <div className="w-full md:w-40">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
              {
                label: 'Active',
                value: 'active'
              },
              {
                label: 'Disabled',
                value: 'disabled'
              },
              {
                label: 'Archived',
                value: 'archived'
              }]
              }
              placeholder="All Statuses" />
            
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedAccounts}
          isLoading={isLoading}
          emptyMessage="No credentials found matching your filters." />

        {filteredAccounts.length > 0 &&
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 text-sm">
            <div className="text-slate-500">
              Showing {pageStart + 1}-
              {Math.min(pageStart + accountsPerPage, filteredAccounts.length)} of{' '}
              {filteredAccounts.length} credentials
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">
                Previous
              </button>
              <span className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
              type="button"
              onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={safeCurrentPage === totalPages}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        }
        
      </div>

      <ConfirmDialog
        isOpen={revealConfirmOpen}
        title="Reveal Sensitive Credential"
        message={`You are about to reveal the PIN/Secret for "${accountToReveal?.display_label}". This action will be recorded in the audit log.`}
        confirmLabel="Reveal & Log"
        isDanger={false}
        onConfirm={confirmReveal}
        onCancel={() => {
          setRevealConfirmOpen(false);
          setAccountToReveal(null);
        }} />

      {isModalOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
            className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)} />
          

            <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4 border-b border-slate-100 pb-3">
                {currentAccount.account_id ? 'Edit Credential' : 'Add Credential'}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Organization <span className="text-red-500">*</span>
                    </label>
                    <select
                    required
                    value={currentOrgId}
                    onChange={(e) => {
                    setCurrentOrgId(e.target.value);
                    setCurrentAccount({
                      ...currentAccount,
                      person_id: undefined,
                      system_id: undefined
                    });
                    }}
                    className="input-field mt-1">
                      <option value="">Select organization</option>
                      {orgs.map((org) =>
                    <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                    )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Person <span className="text-red-500">*</span>
                    </label>
                    <select
                    required
                    value={currentAccount.person_id || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      person_id: Number(e.target.value)
                    })
                    }
                    className="input-field mt-1">
                      <option value="">Select person</option>
                      {formPeople.map((person) =>
                    <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                    )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      System <span className="text-red-500">*</span>
                    </label>
                    <select
                    required
                    value={currentAccount.system_id || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      system_id: Number(e.target.value)
                    })
                    }
                    className="input-field mt-1">
                      <option value="">Select system</option>
                      {formSystems.map((system) =>
                    <option key={system.id} value={system.id}>
                          {system.name}
                        </option>
                    )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="text"
                    required
                    value={currentAccount.username || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      username: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Display Label
                    </label>
                    <input
                    type="text"
                    value={currentAccount.display_label || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      display_label: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Extension
                    </label>
                    <input
                    type="text"
                    value={currentAccount.ext_number || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      ext_number: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Phone Line
                    </label>
                    <input
                    type="text"
                    value={currentAccount.phone_line || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      phone_line: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      PIN / Secret
                    </label>
                    <input
                    type="text"
                    value={currentAccount.pin_code || ''}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      pin_code: e.target.value
                    })
                    }
                    className="input-field mt-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Status
                    </label>
                    <select
                    value={currentAccount.status || 'active'}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      status: e.target.value as Account['status']
                    })
                    }
                    className="input-field mt-1">
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-center">
                    <input
                    id="is_shared"
                    type="checkbox"
                    checked={!!currentAccount.is_shared}
                    onChange={(e) =>
                    setCurrentAccount({
                      ...currentAccount,
                      is_shared: e.target.checked
                    })
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded" />
                    <label
                    htmlFor="is_shared"
                    className="ml-2 block text-sm text-slate-700">
                      Shared credential
                    </label>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 sm:flex sm:flex-row-reverse">
                  <button
                  type="submit"
                  disabled={
                  isSubmitting ||
                  !currentOrgId ||
                  !currentAccount.person_id ||
                  !currentAccount.system_id ||
                  !currentAccount.username
                  }
                  className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Save Credential'}
                  </button>
                  <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }
      
    </div>);

};
