import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import Chart from 'chart.js/auto';
import { supabase } from './supabaseClient'; // VERIFIQUE SE O CAMINHO ESTÁ CORRETO
import type { Session } from '@supabase/supabase-js';

// --- DATA TYPES --- //
interface Doctor {
  id: string;
  name: string;
  color: string;
}

// Perfil do usuário logado (Representante)
interface UserProfile {
    id: string; // Corresponde ao auth.users.id
    doctor_id: string; // Corresponde ao doctors.id
    is_admin?: boolean;
    // Juntamos o nome para facilitar o uso
    name?: string;
}

interface Hospital {
  id: string;
  name: string;
}

interface InsurancePlan {
  id: string;
  name: string;
}

interface Material {
    name: string;
    quantity: number;
}

interface Surgery {
  id: string;
  patientName: string;
  mainSurgeonId: string;
  participatingIds: string[];
  dateTime: string;
  hospitalId: string;
  insuranceId: string;
  authStatus: 'Pendente' | 'Liberado' | 'Recusado';
  surgeryStatus: 'Agendada' | 'Realizada' | 'Cancelada';
  totalValue: number;
  materials: Material[];
  notes: string;
}


// --- TOAST NOTIFICATIONS --- //
type ToastType = 'success' | 'error';
interface ToastMessage { id: number; message: string; type: ToastType; }
interface ToastContextType { addToast: (message: string, type: ToastType) => void; }
const ToastContext = createContext<ToastContextType | null>(null);

const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const addToast = (message: string, type: ToastType) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 5000);
    };
    const removeToast = (id: number) => setToasts(prev => prev.filter(toast => toast.id !== id));
    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <span className="material-symbols-outlined">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => removeToast(toast.id)}>&times;</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const getDoctorById = (id: string, doctors: Doctor[]) => doctors.find(d => d.id === id);

// --- COMPONENTES --- //

/**
 * Login View
 */
const LoginView: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setLoading(true); setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };
    return (
        <div className="login-container">
            <form className="login-box" onSubmit={handleLogin}>
                <div className="login-logo"><span className="material-symbols-outlined">health_and_safety</span></div>
                <h2>Bem-vindo</h2><p>Faça o login para continuar.</p>
                <div className="form-group"><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="form-group"><label htmlFor="password">Senha</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                {error && <p className="error-message">{error}</p>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
            </form>
        </div>
    );
};

/**
 * Header Component
 */
const AppHeader: React.FC<{
  currentView: string; onNavigate: (view: any) => void; loggedInUser: UserProfile; onLogout: () => void;
  searchQuery: string; onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  theme: 'light' | 'dark'; onToggleTheme: () => void;
}> = ({ currentView, onNavigate, loggedInUser, onLogout, searchQuery, onSearchChange, theme, onToggleTheme }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const userName = loggedInUser.name || 'Usuário';
  return (
    <header className="app-header">
      <h1><span className="material-symbols-outlined">health_and_safety</span> Agenda NL</h1>
      <nav>
        <a href="#dashboard" className={currentView === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}>Dashboard</a>
        <a href="#agenda" className={currentView === 'agenda' ? 'active' : ''} onClick={() => onNavigate('agenda')}>Agenda</a>
        <a href="#relatorios" className={currentView === 'relatorios' ? 'active' : ''} onClick={() => onNavigate('relatorios')}>Relatórios</a>
        <a href="#cadastros" className={currentView === 'cadastros' ? 'active' : ''} onClick={() => onNavigate('cadastros')}>Cadastros</a>
        {loggedInUser.is_admin && (<a href="#admin" className={currentView === 'admin' ? 'active' : ''} onClick={() => onNavigate('admin')}>Administradores</a>)}
      </nav>
      <div className="header-actions">
        <div className="header-search"><span className="material-symbols-outlined search-icon">search</span><input type="search" placeholder="Buscar paciente..." value={searchQuery} onChange={onSearchChange}/></div>
        <div className="user-info" ref={userMenuRef}>
            <button className="user-avatar-btn" onClick={() => setIsUserMenuOpen(p => !p)}>{userName.charAt(0)}</button>
            {isUserMenuOpen && (<div className="user-menu">
                <div className="user-menu-header"><span>{userName}</span><small>{loggedInUser.is_admin ? 'Administrador' : 'Representante'}</small></div>
                <button onClick={onToggleTheme}><span className="material-symbols-outlined">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</button>
                <div className="divider"></div>
                <button onClick={onLogout}><span className="material-symbols-outlined">logout</span>Sair</button>
            </div>)}
        </div>
      </div>
    </header>
  );
};

/**
 * Surgery Modal
 */
const SurgeryModal: React.FC<{
  isOpen: boolean; onClose: () => void; onSave: (data: Omit<Surgery, 'id'>, id?: string) => Promise<void>;
  hospitals: Hospital[]; insurancePlans: InsurancePlan[]; surgeryToEdit: Surgery | null;
  initialDate: Date; doctors: Doctor[];
}> = ({ isOpen, onClose, onSave, hospitals, insurancePlans, surgeryToEdit, initialDate, doctors }) => {
  const { addToast } = useToast();

  const [materialName, setMaterialName] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState(1);

  const createInitialState = useCallback(() => {
    const d = initialDate;
    const defaultDateTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`;
    return {
        patientName: '', mainSurgeonId: doctors[0]?.id || '', participatingIds: [], dateTime: defaultDateTime, hospitalId: hospitals[0]?.id || '', insuranceId: insurancePlans[0]?.id || '',
        authStatus: 'Pendente' as const, surgeryStatus: 'Agendada' as const, totalValue: 0, materials: [], notes: '',
    };
  }, [initialDate, doctors, hospitals, insurancePlans]);

  const [formData, setFormData] = useState<Omit<Surgery, 'id'>>(createInitialState());

  useEffect(() => {
    if (isOpen) {
        if (surgeryToEdit) {
            const formattedData = {
                ...surgeryToEdit,
                materials: surgeryToEdit.materials || [],
                dateTime: surgeryToEdit.dateTime ? surgeryToEdit.dateTime.slice(0, 16) : '',
            };
            setFormData(formattedData);
        } else {
            setFormData(createInitialState());
        }
    }
  }, [surgeryToEdit, isOpen, createInitialState]);

  const handleChange = (e: React.ChangeEvent<any>) => {
      const { name, value } = e.target;
      setFormData(p => ({ ...p, [name]: name === 'totalValue' ? parseFloat(value) || 0 : value }));
  };

  const handleCheckboxChange = (docId: string) => setFormData(p => ({ ...p, participatingIds: p.participatingIds.includes(docId) ? p.participatingIds.filter(id => id !== docId) : [...p.participatingIds, docId] }));

  const handleAddMaterial = () => {
      if (!materialName.trim() || materialQuantity <= 0) {
          addToast('Preencha o nome e a quantidade do material.', 'error');
          return;
      }
      setFormData(p => ({
          ...p,
          materials: [...p.materials, { name: materialName, quantity: materialQuantity }]
      }));
      setMaterialName('');
      setMaterialQuantity(1);
  };

  const handleRemoveMaterial = (index: number) => {
      setFormData(p => ({
          ...p,
          materials: p.materials.filter((_, i) => i !== index)
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.patientName.trim()) {
          addToast('O nome do paciente é obrigatório.', 'error');
          return;
      }
      if (!formData.mainSurgeonId) {
          addToast('É obrigatório selecionar um representante.', 'error');
          return;
      }
      await onSave(formData, surgeryToEdit?.id);
  };

  if (!isOpen) return null;

  const otherDoctors = doctors.filter(d => d.id !== formData.mainSurgeonId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header"><h3>{surgeryToEdit ? 'Editar Cirurgia' : 'Nova Cirurgia'}</h3><button type="button" className="close-btn" onClick={onClose}>&times;</button></div>
          <div className="modal-body">
            <div className="form-group"><label>Paciente</label><input type="text" name="patientName" value={formData.patientName} onChange={handleChange} required/></div>
            <div className="form-group"><label>Representante</label><select name="mainSurgeonId" value={formData.mainSurgeonId} onChange={handleChange}>{doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="form-group"><label>Médicos Participantes</label><div className="checkbox-container">{otherDoctors.map(d=><label key={d.id}><input type="checkbox" checked={formData.participatingIds.includes(d.id)} onChange={()=>handleCheckboxChange(d.id)}/>{d.name}</label>)}</div></div>
            <div className="form-group"><label>Data e Hora</label><input type="datetime-local" name="dateTime" value={formData.dateTime} onChange={handleChange}/></div>
            <div className="form-group"><label>Hospital</label><select name="hospitalId" value={formData.hospitalId} onChange={handleChange}>{hospitals.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
            <div className="form-group"><label>Convênio</label><select name="insuranceId" value={formData.insuranceId} onChange={handleChange}>{insurancePlans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="form-group"><label>Status Liberação</label><select name="authStatus" value={formData.authStatus} onChange={handleChange}><option>Pendente</option><option>Liberado</option><option>Recusado</option></select></div>
            <div className="form-group"><label>Status Cirurgia</label><select name="surgeryStatus" value={formData.surgeryStatus} onChange={handleChange}><option>Agendada</option><option>Realizada</option><option>Cancelada</option></select></div>

            <div className="form-group">
                <label>Materiais</label>
                <div className="material-input-group">
                    <input type="text" placeholder="Nome do material" value={materialName} onChange={e => setMaterialName(e.target.value)} />
                    <input type="number" placeholder="Qtd." value={materialQuantity} onChange={e => setMaterialQuantity(parseInt(e.target.value) || 1)} min="1" />
                    <button type="button" className="btn btn-secondary" onClick={handleAddMaterial}>Adicionar</button>
                </div>
                <div className="material-list">
                    {formData.materials.map((mat, index) => (
                        <div key={index} className="material-item">
                            <span>{mat.name} (Qtd: {mat.quantity})</span>
                            <button type="button" onClick={() => handleRemoveMaterial(index)}>&times;</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="form-group"><label>Valor Total da Cirurgia</label><input type="number" name="totalValue" value={formData.totalValue} onChange={handleChange} placeholder="0,00"/></div>

            <div className="form-group"><label>Notas</label><textarea name="notes" value={formData.notes} onChange={handleChange}></textarea></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
        </form>
      </div>
    </div>
  );
};
/**
 * Advanced Filters Panel
 */
const AdvancedFiltersPanel: React.FC<{
    isOpen: boolean; onClose: () => void; currentFilters: any; onApplyFilters: (filters: any) => void;
    hospitals: Hospital[]; insurancePlans: InsurancePlan[];
}> = ({ isOpen, onClose, currentFilters, onApplyFilters, hospitals, insurancePlans }) => {
    const [filters, setFilters] = useState(currentFilters);
    useEffect(() => { setFilters(currentFilters); }, [currentFilters]);
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters((prev: any) => ({ ...prev, [name]: value }));
    };
    const handleApply = () => { onApplyFilters(filters); onClose(); };
    const handleReset = () => {
        const resetFilters = { authStatus: 'all', surgeryStatus: 'all', hospitalId: 'all', insuranceId: 'all' };
        setFilters(resetFilters);
        onApplyFilters(resetFilters);
        onClose();
    };
    return (
        <>
            <div className={`filters-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`filters-panel ${isOpen ? 'open' : ''}`}>
                <div className="filters-panel-header"><h3>Filtros Avançados</h3><button className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button></div>
                <div className="filters-panel-body">
                    <div className="form-group"><label htmlFor="authStatus">Status da Autorização</label><select id="authStatus" name="authStatus" value={filters.authStatus} onChange={handleChange}><option value="all">Todos</option><option value="Pendente">Pendente</option><option value="Liberado">Liberado</option><option value="Recusado">Recusado</option></select></div>
                    <div className="form-group"><label htmlFor="surgeryStatus">Status da Cirurgia</label><select id="surgeryStatus" name="surgeryStatus" value={filters.surgeryStatus} onChange={handleChange}><option value="all">Todos</option><option value="Agendada">Agendada</option><option value="Realizada">Realizada</option><option value="Cancelada">Cancelada</option></select></div>
                    <div className="form-group"><label htmlFor="hospitalId">Hospital</label><select id="hospitalId" name="hospitalId" value={filters.hospitalId} onChange={handleChange}><option value="all">Todos</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                    <div className="form-group"><label htmlFor="insuranceId">Convênio</label><select id="insuranceId" name="insuranceId" value={filters.insuranceId} onChange={handleChange}><option value="all">Todos</option>{insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                </div>
                <div className="filters-panel-footer"><button className="btn btn-secondary" onClick={handleReset}>Limpar Filtros</button><button className="btn btn-primary" onClick={handleApply}>Aplicar</button></div>
            </div>
        </>
    );
};

/**
 * Calendar View Component
 */
const CalendarView: React.FC<{
    surgeries: Surgery[]; onDayClick: (date: Date) => void; onSurgeryClick: (surgery: Surgery) => void;
    onSurgeryDrop: (surgeryId: string, newDate: Date) => void; doctors: Doctor[]; hospitals: Hospital[]; insurancePlans: InsurancePlan[];
}> = ({ surgeries, onDayClick, onSurgeryClick, onSurgeryDrop, doctors, hospitals, insurancePlans }) => {
    const [doctorFilter, setDoctorFilter] = useState<string | 'all'>('all');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({ authStatus: 'all', surgeryStatus: 'all', hospitalId: 'all', insuranceId: 'all' });

    const handlePrev = () => setCurrentDate(d => { const n = new Date(d); if (viewMode === 'month') n.setMonth(d.getMonth() - 1); else n.setDate(d.getDate() - 7); return n; });
    const handleNext = () => setCurrentDate(d => { const n = new Date(d); if (viewMode === 'month') n.setMonth(d.getMonth() + 1); else n.setDate(d.getDate() + 7); return n; });

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const grid: (Date | null)[] = [];
        for (let i = 0; i < firstDayOfMonth; i++) grid.push(null);
        for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(year, month, i));
        return grid;
    }, [currentDate]);

    const weekGrid = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const grid: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            grid.push(day);
        }
        return grid;
    }, [currentDate]);

    const filteredSurgeries = useMemo(() => {
        return surgeries.filter(s => {
            if (doctorFilter !== 'all' && s.mainSurgeonId !== doctorFilter && !s.participatingIds.includes(doctorFilter)) {
                return false;
            }
            if (advancedFilters.authStatus !== 'all' && s.authStatus !== advancedFilters.authStatus) return false;
            if (advancedFilters.surgeryStatus !== 'all' && s.surgeryStatus !== advancedFilters.surgeryStatus) return false;
            if (advancedFilters.hospitalId !== 'all' && s.hospitalId !== advancedFilters.hospitalId) return false;
            if (advancedFilters.insuranceId !== 'all' && s.insuranceId !== advancedFilters.insuranceId) return false;
            return true;
        });
    }, [surgeries, doctorFilter, advancedFilters]);

    const getAuthStatusIcon = (status: Surgery['authStatus']) => {
        switch (status) {
            case 'Liberado': return 'verified';
            case 'Recusado': return 'gpp_bad';
            default: return 'hourglass_top';
        }
    };

    const getSurgeryTooltip = (s: Surgery) => {
        const mainSurgeon = getDoctorById(s.mainSurgeonId, doctors)?.name || 'N/A';
        const participants = s.participatingIds.map(id => getDoctorById(id, doctors)?.name).filter(Boolean).join(', ');
        const hospital = hospitals.find(h => h.id === s.hospitalId)?.name || 'N/A';
        const insurance = insurancePlans.find(p => p.id === s.insuranceId)?.name || 'N/A';
        return `Paciente: ${s.patientName}\nData: ${new Date(s.dateTime).toLocaleString('pt-BR')}\nHospital: ${hospital}\nConvênio: ${insurance}\nRepresentante: ${mainSurgeon}\n${participants ? `Equipe: ${participants}\n` : ''}Status Cirurgia: ${s.surgeryStatus}\nStatus Autorização: ${s.authStatus}`;
    };

    const onDragStart = (e: React.DragEvent, surgeryId: string) => e.dataTransfer.setData("surgeryId", surgeryId);
    const onDragOver = (e: React.DragEvent) => e.preventDefault();
    const onDrop = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const surgeryId = e.dataTransfer.getData("surgeryId");
        if (surgeryId && date) onSurgeryDrop(surgeryId, date);
        setDragOverDate(null);
    };

    const removeFilter = (filterKey: keyof typeof advancedFilters) => setAdvancedFilters(prev => ({ ...prev, [filterKey]: 'all' }));

    const displayedGrid = viewMode === 'month' ? calendarGrid : weekGrid;
    const gridClass = viewMode === 'month' ? 'calendar-grid' : 'calendar-grid-week';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeFilters = Object.entries(advancedFilters).filter(([, value]) => value !== 'all');

    return (
        <div className="calendar-view-container">
            <div className="calendar-toolbar">
                <div className="calendar-nav">
                    <button className="btn btn-primary" onClick={handlePrev}>&lt;</button>
                    <h2>{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                    <button className="btn btn-primary" onClick={handleNext}>&gt;</button>
                </div>
                <div className="calendar-view-controls">
                    <div className="view-switcher">
                        <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Mês</button>
                        <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Semana</button>
                    </div>
                    <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
                        <option value="all">Todos os Médicos</option>
                        {doctors.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                    </select>
                    <button className="btn btn-secondary" onClick={() => setIsFilterPanelOpen(true)}>
                        <span className="material-symbols-outlined">filter_list</span> Filtros
                    </button>
                </div>
            </div>
            {activeFilters.length > 0 && (
                <div className="applied-filters-container">
                    {activeFilters.map(([key, value]) => {
                        let label = '';
                        if (key === 'hospitalId') label = hospitals.find(h => h.id === value)?.name || '';
                        else if (key === 'insuranceId') label = insurancePlans.find(p => p.id === value)?.name || '';
                        else label = String(value);
                        return (
                            <div key={key} className="filter-tag">
                                <span>{label}</span>
                                <button onClick={() => removeFilter(key as any)}>&times;</button>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className={gridClass}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="calendar-header">{day}</div>)}
                {displayedGrid.map((date, index) => {
                    const isToday = date && date.getTime() === today.getTime();
                    const daySurgeries = date ? filteredSurgeries.filter(s => {
                        const sDate = new Date(s.dateTime);
                        return sDate.getFullYear() === date.getFullYear() && sDate.getMonth() === date.getMonth() && sDate.getDate() === date.getDate();
                    }) : [];
                    const dateString = date ? date.toISOString().split('T')[0] : '';
                    const isDragOver = dateString === dragOverDate;
                    return (
                        <div key={index} className={`calendar-day ${!date ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isDragOver ? 'drag-over' : ''}`}
                            onClick={() => date && onDayClick(date)} onDragOver={onDragOver} onDrop={(e) => date && onDrop(e, date)}
                            onDragEnter={() => date && setDragOverDate(date.toISOString().split('T')[0])} onDragLeave={() => setDragOverDate(null)}
                        >
                            {date && <span className="day-number">{date.getDate()}</span>}
                            {daySurgeries.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(s => {
                                const doctor = getDoctorById(s.mainSurgeonId, doctors);
                                const hospital = hospitals.find(h => h.id === s.hospitalId);
                                return (
                                    <div key={s.id} draggable={viewMode === 'month'} onDragStart={(e) => onDragStart(e, s.id)} className="surgery-item"
                                        style={{ '--doctor-color': doctor?.color } as React.CSSProperties} onClick={(e) => { e.stopPropagation(); onSurgeryClick(s); }} title={getSurgeryTooltip(s)}
                                    >
                                        <div className="surgery-item-header">
                                            <span className="surgery-time">{new Date(s.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className={`material-symbols-outlined auth-status-icon status-${s.authStatus.toLowerCase()}`}>{getAuthStatusIcon(s.authStatus)}</span>
                                        </div>
                                        <div className="surgery-item-body">
                                            <span className="surgery-patient">{s.patientName}</span>
                                            <span className="surgery-hospital">{hospital?.name || 'Hospital não definido'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            <AdvancedFiltersPanel isOpen={isFilterPanelOpen} onClose={() => setIsFilterPanelOpen(false)} currentFilters={advancedFilters}
                onApplyFilters={setAdvancedFilters} hospitals={hospitals} insurancePlans={insurancePlans}
            />
        </div>
    );
};

/**
 * Settings (Cadastros) View - ATUALIZADO
 */
const SettingsView: React.FC<{
    hospitals: Hospital[];
    insurancePlans: InsurancePlan[];
    doctors: Doctor[]; // Adicionado
    onAddHospital: (name: string) => Promise<void>;
    onDeleteHospital: (id: string) => Promise<void>;
    onAddPlan: (name: string) => Promise<void>;
    onDeletePlan: (id: string) => Promise<void>;
    onAddDoctor: (name: string) => Promise<void>; // Adicionado
    onDeleteDoctor: (id: string) => Promise<void>; // Adicionado
}> = ({ hospitals, insurancePlans, doctors, onAddHospital, onDeleteHospital, onAddPlan, onDeletePlan, onAddDoctor, onDeleteDoctor }) => {
    const [newHospital, setNewHospital] = useState('');
    const [newPlan, setNewPlan] = useState('');
    const [newDoctor, setNewDoctor] = useState(''); // Adicionado

    const handleAddHospital = async () => {
        if (newHospital.trim()) {
            await onAddHospital(newHospital.trim());
            setNewHospital('');
        }
    };

    const handleAddPlan = async () => {
        if (newPlan.trim()) {
            await onAddPlan(newPlan.trim());
            setNewPlan('');
        }
    };

    const handleAddDoctor = async () => { // Adicionado
        if (newDoctor.trim()) {
            await onAddDoctor(newDoctor.trim());
            setNewDoctor('');
        }
    };

    return (
        <div className="settings-container">
            <h2>Cadastros Gerais</h2>
            <div className="settings-grid">
                {/* Card de Médicos */}
                <div className="settings-card">
                    <h3>Médicos</h3>
                    <div className="add-item-form">
                        <input type="text" value={newDoctor} onChange={e => setNewDoctor(e.target.value)} placeholder="Nome do novo médico"/>
                        <button className="btn btn-primary" onClick={handleAddDoctor}>Adicionar</button>
                    </div>
                    <div className="items-list">
                        {doctors.map(d => (
                            <div key={d.id} className="list-item">
                                <span>{d.name}</span>
                                <button className="btn-icon btn-danger" onClick={() => onDeleteDoctor(d.id)} title="Excluir">
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card de Hospitais */}
                <div className="settings-card">
                    <h3>Hospitais</h3>
                    <div className="add-item-form">
                        <input type="text" value={newHospital} onChange={e => setNewHospital(e.target.value)} placeholder="Novo hospital"/>
                        <button className="btn btn-primary" onClick={handleAddHospital}>Adicionar</button>
                    </div>
                    <div className="items-list">
                        {hospitals.map(h => (
                            <div key={h.id} className="list-item">
                                <span>{h.name}</span>
                                <button className="btn-icon btn-danger" onClick={() => onDeleteHospital(h.id)} title="Excluir">
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card de Convênios */}
                <div className="settings-card">
                    <h3>Convênios</h3>
                    <div className="add-item-form">
                        <input type="text" value={newPlan} onChange={e => setNewPlan(e.target.value)} placeholder="Novo convênio"/>
                        <button className="btn btn-primary" onClick={handleAddPlan}>Adicionar</button>
                    </div>
                     <div className="items-list">
                        {insurancePlans.map(p => (
                            <div key={p.id} className="list-item">
                                <span>{p.name}</span>
                                <button className="btn-icon btn-danger" onClick={() => onDeletePlan(p.id)} title="Excluir">
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Reports View
 */
const ReportsView: React.FC<{
    surgeries: Surgery[]; hospitals: Hospital[]; insurancePlans: InsurancePlan[]; doctors: Doctor[]; theme: 'light' | 'dark';
}> = ({ surgeries, hospitals, insurancePlans, doctors, theme }) => {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        doctorId: 'all' as 'all' | string,
    });
    const surgeriesByHospitalCanvas = useRef<HTMLCanvasElement>(null);
    const hospitalChartRef = useRef<Chart | null>(null);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const filteredSurgeries = useMemo(() => {
        return surgeries.filter(s => {
            const surgeryDate = new Date(s.dateTime);
            if (filters.startDate && surgeryDate < new Date(filters.startDate)) return false;
            if (filters.endDate) {
                 const endDate = new Date(filters.endDate);
                 endDate.setHours(23, 59, 59, 999);
                 if (surgeryDate > endDate) return false;
            }
            if (filters.doctorId !== 'all') {
                const doctorIds = [s.mainSurgeonId, ...s.participatingIds];
                if (!doctorIds.includes(filters.doctorId)) return false;
            }
            return true;
        });
    }, [surgeries, filters]);

    const reports = useMemo(() => {
        const realizedSurgeries = filteredSurgeries.filter(s => s.surgeryStatus === 'Realizada');
        const totalRevenue = realizedSurgeries.reduce((acc, s) => acc + (s.totalValue || 0), 0);

        const hospitalMap = new Map(hospitals.map(h => [h.id, h.name]));
        const surgeriesByHospital = filteredSurgeries.reduce<Record<string, number>>((acc, s) => {
            const hospitalName = hospitalMap.get(s.hospitalId) || 'Desconhecido';
            acc[hospitalName] = (acc[hospitalName] || 0) + 1;
            return acc;
        }, {});

        return { totalRevenue, surgeriesByHospital, totalSurgeries: filteredSurgeries.length, realizedSurgeriesCount: realizedSurgeries.length };
    }, [filteredSurgeries, hospitals]);

    useEffect(() => {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color');

        if (surgeriesByHospitalCanvas.current) {
            if (hospitalChartRef.current) hospitalChartRef.current.destroy();
            const sortedHospitals = Object.entries(reports.surgeriesByHospital).sort(([, a], [, b]) => b - a);
            hospitalChartRef.current = new Chart(surgeriesByHospitalCanvas.current, {
                type: 'pie',
                data: {
                    labels: sortedHospitals.map(([name]) => name),
                    datasets: [{ label: 'Cirurgias', data: sortedHospitals.map(([, value]) => value), backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: textColor } } } }
            });
        }

        return () => {
            if (hospitalChartRef.current) hospitalChartRef.current.destroy();
        }
    }, [reports, theme]);

    const exportToCSV = () => { /* ... Lógica de exportação ... */ };

    return (
        <div className="reports-container">
            <div className="reports-header">
                <h2>Relatórios</h2>
                <button className="btn btn-primary" onClick={exportToCSV}><span className="material-symbols-outlined">download</span>Exportar para CSV</button>
            </div>
            <div className="reports-filters">
                <div className="form-group"><label>Data de Início</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} /></div>
                <div className="form-group"><label>Data de Fim</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} /></div>
                <div className="form-group"><label>Médico/Representante</label>
                    <select name="doctorId" value={filters.doctorId} onChange={handleFilterChange}>
                        <option value="all">Todos</option>
                        {doctors.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="report-grid">
                <div className="report-card"><div className="report-card-header"><h4>Faturamento Total</h4><span className="material-symbols-outlined">payments</span></div><p>{reports.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                <div className="report-card"><div className="report-card-header"><h4>Total de Cirurgias</h4><span className="material-symbols-outlined">summarize</span></div><p>{reports.totalSurgeries}</p></div>
                <div className="report-card"><div className="report-card-header"><h4>Cirurgias Realizadas</h4><span className="material-symbols-outlined">check_circle</span></div><p>{reports.realizedSurgeriesCount}</p></div>
            </div>
            <div className="report-details-grid single-chart">
                <div className="report-details-card"><h3>Cirurgias por Hospital</h3><div className="chart-container"><canvas ref={surgeriesByHospitalCanvas}></canvas></div></div>
            </div>
        </div>
    );
};
/**
 * Admin View for User Management
 */
const AdminView: React.FC<{
  users: UserProfile[]; // Lista de usuários do sistema
  loggedInUser: UserProfile;
  // onUpdateUser: (userId: string, data: { name: string; is_admin: boolean }) => Promise<void>;
}> = ({ users, loggedInUser }) => {
  // Esta tela pode ser adaptada no futuro para gerenciar permissões de outros representantes
  return (
    <div className="admin-container">
      <h2>Gerenciar Administradores</h2>
        <p>Esta seção pode ser usada para gerenciar outros usuários representantes no futuro.</p>
      <div className="user-list">
        <h3>Usuários Atuais do Sistema</h3>
        {users.map(user => (
          <div key={user.id} className="list-item">
            <span>{user.name} {user.is_admin && <strong>(Admin)</strong>}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Dashboard View
 */
const DashboardView: React.FC<{
    surgeries: Surgery[];
    doctors: Doctor[];
    onSurgeryClick: (surgery: Surgery) => void;
}> = ({ surgeries, doctors, onSurgeryClick }) => {

    const { surgeriesToday, pendingAuthCount, monthRevenue } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const todaysSurgeries = surgeries.filter(s => {
            const sDate = new Date(s.dateTime);
            return sDate.getFullYear() === currentYear &&
                   sDate.getMonth() === currentMonth &&
                   sDate.getDate() === today.getDate();
        });

        const pending = surgeries.filter(s => s.authStatus === 'Pendente').length;

        const revenue = surgeries
            .filter(s => {
                const sDate = new Date(s.dateTime);
                return s.surgeryStatus === 'Realizada' &&
                       sDate.getMonth() === currentMonth &&
                       sDate.getFullYear() === currentYear;
            })
            .reduce((acc, s) => acc + (s.totalValue || 0), 0);

        return {
            surgeriesToday: todaysSurgeries,
            pendingAuthCount: pending,
            monthRevenue: revenue
        };
    }, [surgeries]);

    return (
        <div className="dashboard-view">
            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <div className="dashboard-card-header"><h4>Cirurgias Hoje</h4><span className="material-symbols-outlined">today</span></div>
                    <p>{surgeriesToday.length}</p>
                </div>
                 <div className="dashboard-card">
                    <div className="dashboard-card-header"><h4>Autorizações Pendentes</h4><span className="material-symbols-outlined">pending_actions</span></div>
                    <p>{pendingAuthCount}</p>
                </div>
                 <div className="dashboard-card">
                    <div className="dashboard-card-header"><h4>Faturamento do Mês</h4><span className="material-symbols-outlined">payments</span></div>
                    <p>{monthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>
            <div className="todays-surgeries">
                <h2>Cirurgias do Dia</h2>
                {surgeriesToday.length > 0 ? (
                    surgeriesToday.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(s => (
                         <div key={s.id} className="list-item" onClick={() => onSurgeryClick(s)}>
                             <span>
                                 <strong>{new Date(s.dateTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</strong> - {s.patientName}
                                 <br />
                                 <small style={{color: 'var(--text-muted-color)'}}>{getDoctorById(s.mainSurgeonId, doctors)?.name}</small>
                             </span>
                             <span className={`material-symbols-outlined status-icon status-${s.surgeryStatus.toLowerCase()}`}>{s.surgeryStatus === 'Realizada' ? 'check_circle' : s.surgeryStatus === 'Cancelada' ? 'cancel' : 'pending'}</span>
                         </div>
                    ))
                ) : (
                    <p className="no-surgeries">Nenhuma cirurgia agendada para hoje.</p>
                )}
            </div>
        </div>
    );
}

/**
 * Day Detail Panel
 */
const DayDetailPanel: React.FC<{
    isOpen: boolean; onClose: () => void; selectedDate: Date | null; surgeriesForDay: Surgery[];
    onSurgeryClick: (surgery: Surgery) => void; onAddNewSurgery: (date: Date) => void; doctors: Doctor[];
}> = ({ isOpen, onClose, selectedDate, surgeriesForDay, onSurgeryClick, onAddNewSurgery, doctors }) => {
    if (!selectedDate) return null;
    return (
        <>
            <div className={`day-detail-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`day-detail-panel ${isOpen ? 'open' : ''}`}>
                <div className="day-detail-header">
                    <h3>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    <button className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
                </div>
                <div className="day-detail-body">
                    {surgeriesForDay.length > 0 ? (
                        surgeriesForDay.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(s => {
                            const doctor = getDoctorById(s.mainSurgeonId, doctors);
                            const time = new Date(s.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={s.id} className="surgery-item" onClick={() => onSurgeryClick(s)} style={{ '--doctor-color': doctor?.color } as React.CSSProperties}>
                                    <div className="surgery-item-content"><span className="surgery-time">{time}</span><span className="surgery-patient">{s.patientName}</span></div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="no-surgeries"><span className="material-symbols-outlined">event_busy</span><p>Nenhuma cirurgia neste dia.</p></div>
                    )}
                </div>
                <div className="day-detail-footer"><button className="btn btn-primary btn-full" onClick={() => onAddNewSurgery(selectedDate)}>Adicionar Cirurgia</button></div>
            </div>
        </>
    );
};


/**
 * Main App Component
 */
const App = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<'dashboard' | 'agenda' | 'relatorios' | 'cadastros' | 'admin'>('dashboard');
    const [doctors, setDoctors] = useState<Doctor[]>([]); // Lista geral de médicos
    const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]); // Usuários do sistema
    const [surgeries, setSurgeries] = useState<Surgery[]>([]);
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [loggedInProfile, setLoggedInProfile] = useState<UserProfile | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [surgeryToEdit, setSurgeryToEdit] = useState<Surgery | null>(null);
    const [modalInitialDate, setModalInitialDate] = useState(new Date());
    const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
    const [selectedDateForPanel, setSelectedDateForPanel] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { addToast } = useToast();

    const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));

    const fetchData = useCallback(async (currentSession: Session) => {
        setLoading(true);
        try {
            // 1. Busca o perfil do usuário logado
            const { data: profile, error: profileError } = await supabase.from('user_profiles').select(`*, doctor:doctors(*)`).eq('id', currentSession.user.id).single();
            if (profileError || !profile) {
                await supabase.auth.signOut();
                throw new Error("Perfil do usuário não encontrado. Realizando logout.");
            }
            const loggedInUser = { ...profile, name: profile.doctor.name };
            setLoggedInProfile(loggedInUser);

            // 2. Busca todos os dados em paralelo
            const [doctorsRes, surgeriesRes, hospitalsRes, plansRes, profilesRes] = await Promise.all([
                supabase.from('doctors').select('*').order('name'),
                supabase.from('surgeries').select('*'),
                supabase.from('hospitals').select('*').order('name'),
                supabase.from('insurance_plans').select('*').order('name'),
                supabase.from('user_profiles').select(`*, doctor:doctors(name)`) // Para a tela de admin
            ]);

            if (doctorsRes.error) throw doctorsRes.error; setDoctors(doctorsRes.data || []);
            if (surgeriesRes.error) throw surgeriesRes.error; setSurgeries(surgeriesRes.data || []);
            if (hospitalsRes.error) throw hospitalsRes.error; setHospitals(hospitalsRes.data || []);
            if (plansRes.error) throw plansRes.error; setInsurancePlans(plansRes.data || []);
            if (profilesRes.error) throw profilesRes.error;

            const allUsers = profilesRes.data.map(p => ({...p, name: p.doctor.name}));
            setUserProfiles(allUsers);

        } catch (error: any) {
            addToast(`Erro ao carregar dados: ${error.message}`, 'error');
            setLoggedInProfile(null);
            setSession(null);
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                setLoggedInProfile(null);
                setLoading(false);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => { if (session) { fetchData(session) } else { setLoggedInProfile(null) } }, [session, fetchData]);
    useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

    const handleLogout = async () => await supabase.auth.signOut();
    const handleSaveSurgery = async (data: Omit<Surgery, 'id'>, id?: string) => {
        try {
            const payload = id ? { ...data, id } : data;
            const { error } = await supabase.from('surgeries').upsert(payload);
            if (error) throw error;
            addToast(`Cirurgia ${id ? 'atualizada' : 'salva'}!`, 'success');
            setIsModalOpen(false); setSurgeryToEdit(null);
            if (session) await fetchData(session);
        } catch (error: any) { addToast(`Erro: ${error.message}`, 'error'); }
    };

    const handleSurgeryDrop = async (surgeryId: string, newDate: Date) => {
        const surgery = surgeries.find(s => s.id === surgeryId);
        if (!surgery) return;
        const oldDateTime = new Date(surgery.dateTime);
        const newDateTime = new Date(
            newDate.getFullYear(), newDate.getMonth(), newDate.getDate(),
            oldDateTime.getHours(), oldDateTime.getMinutes()
        ).toISOString();

        const { error } = await supabase.from('surgeries').update({ dateTime: newDateTime }).eq('id', surgeryId);
        if (error) addToast(`Erro ao mover cirurgia: ${error.message}`, 'error');
        else { addToast('Cirurgia movida com sucesso!', 'success'); if (session) await fetchData(session); }
    };

    // --- Funções de Cadastro ---
    const handleAddDoctor = async (name: string) => {
        const { error } = await supabase.from('doctors').insert({ name });
        if (error) addToast(`Erro ao adicionar médico: ${error.message}`, 'error');
        else { addToast('Médico adicionado!', 'success'); if (session) fetchData(session); }
    };
    const handleDeleteDoctor = async (id: string) => {
        const { error } = await supabase.from('doctors').delete().eq('id', id);
        if (error) addToast(`Erro ao excluir médico: ${error.message}`, 'error');
        else { addToast('Médico excluído!', 'success'); if (session) fetchData(session); }
    };
    const handleAddHospital = async (name: string) => {
        const { error } = await supabase.from('hospitals').insert({ name });
        if (error) addToast(`Erro ao adicionar hospital: ${error.message}`, 'error');
        else { addToast('Hospital adicionado!', 'success'); if (session) fetchData(session); }
    };
    const handleDeleteHospital = async (id: string) => {
        const { error } = await supabase.from('hospitals').delete().eq('id', id);
        if (error) addToast(`Erro ao excluir hospital: ${error.message}`, 'error');
        else { addToast('Hospital excluído!', 'success'); if (session) fetchData(session); }
    };
    const handleAddPlan = async (name: string) => {
        const { error } = await supabase.from('insurance_plans').insert({ name });
        if (error) addToast(`Erro ao adicionar convênio: ${error.message}`, 'error');
        else { addToast('Convênio adicionado!', 'success'); if (session) fetchData(session); }
    };
    const handleDeletePlan = async (id: string) => {
        const { error } = await supabase.from('insurance_plans').delete().eq('id', id);
        if (error) addToast(`Erro ao excluir convênio: ${error.message}`, 'error');
        else { addToast('Convênio excluído!', 'success'); if (session) fetchData(session); }
    };

    const handleDayClick = (date: Date) => { setSelectedDateForPanel(date); setIsDayPanelOpen(true); };
    const handleAddNewSurgery = (date: Date) => { setSurgeryToEdit(null); setModalInitialDate(date); setIsModalOpen(true); setIsDayPanelOpen(false); };
    const handleSurgeryClick = (surgery: Surgery) => { setSurgeryToEdit(surgery); setIsModalOpen(true); setIsDayPanelOpen(false); };
    const handleSearchResultClick = (surgery: Surgery) => { handleSurgeryClick(surgery); setSearchQuery(''); };

    const searchedSurgeries = useMemo(() => { if (!searchQuery.trim()) return []; return surgeries.filter(s => s.patientName.toLowerCase().includes(searchQuery.toLowerCase())); }, [searchQuery, surgeries]);
    const surgeriesForSelectedDay = useMemo(() => { if (!selectedDateForPanel) return []; return surgeries.filter(s => new Date(s.dateTime).toDateString() === selectedDateForPanel.toDateString()); }, [surgeries, selectedDateForPanel]);

    const renderContent = () => {
        if (loading) return <div className="loading-spinner">Carregando...</div>;
        if (!loggedInProfile) return null;

        switch (currentView) {
            case 'dashboard': return <DashboardView surgeries={surgeries} doctors={doctors} onSurgeryClick={handleSurgeryClick} />;
            case 'agenda': return <CalendarView surgeries={surgeries} onDayClick={handleDayClick} onSurgeryClick={handleSurgeryClick} onSurgeryDrop={handleSurgeryDrop} doctors={doctors} hospitals={hospitals} insurancePlans={insurancePlans} />;
            case 'relatorios': return <ReportsView surgeries={surgeries} hospitals={hospitals} insurancePlans={insurancePlans} doctors={doctors} theme={theme} />;
            case 'cadastros': return <SettingsView
                                        hospitals={hospitals}
                                        insurancePlans={insurancePlans}
                                        doctors={doctors}
                                        onAddHospital={handleAddHospital}
                                        onDeleteHospital={handleDeleteHospital}
                                        onAddPlan={handleAddPlan}
                                        onDeletePlan={handleDeletePlan}
                                        onAddDoctor={handleAddDoctor}
                                        onDeleteDoctor={handleDeleteDoctor}
                                      />;
            case 'admin':
                if (loggedInProfile.is_admin) {
                    return <AdminView users={userProfiles} loggedInUser={loggedInProfile} />;
                }
                return <h2>Acesso Negado</h2>;
            default: return null;
        }
    };

    if (!session || !loggedInProfile) {
        return <LoginView />;
    }

    return (
        <div className="app-container">
            <AppHeader
                currentView={currentView} onNavigate={setCurrentView} loggedInUser={loggedInProfile} onLogout={handleLogout}
                searchQuery={searchQuery} onSearchChange={e => setSearchQuery(e.target.value)} theme={theme} onToggleTheme={toggleTheme}
            />
            {searchedSurgeries.length > 0 && (
                <div className="search-results">
                    <ul>
                        {searchedSurgeries.map(surgery => (
                            <li key={surgery.id} onClick={() => handleSearchResultClick(surgery)}>
                                <div className="result-patient">{surgery.patientName}</div>
                                <div className="result-details">{getDoctorById(surgery.mainSurgeonId, doctors)?.name} - {new Date(surgery.dateTime).toLocaleDateString('pt-BR')}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <main className="main-content">{renderContent()}</main>
            <button className="fab" onClick={() => handleAddNewSurgery(new Date())} aria-label="Adicionar nova cirurgia">
                <span className="material-symbols-outlined">add</span>
            </button>
            <SurgeryModal
                isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveSurgery}
                hospitals={hospitals} insurancePlans={insurancePlans} surgeryToEdit={surgeryToEdit}
                initialDate={modalInitialDate} doctors={doctors}
            />
            <DayDetailPanel
                isOpen={isDayPanelOpen} onClose={() => setIsDayPanelOpen(false)} selectedDate={selectedDateForPanel}
                surgeriesForDay={surgeriesForSelectedDay} onSurgeryClick={handleSurgeryClick} onAddNewSurgery={handleAddNewSurgery} doctors={doctors}
            />
        </div>
    );
};

const AppWrapper = () => (<ToastProvider><App /></ToastProvider>);
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<AppWrapper />);
}