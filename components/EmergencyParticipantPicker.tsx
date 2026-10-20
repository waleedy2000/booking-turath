'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { normalizeKuwaitiPhone } from '@/lib/phone-utils';

export type SavedParticipantItem = {
  id: string;
  name: string;
  maskedPhone: string;
  departmentName: string;
};

export type ManualInviteeItem = {
  name: string;
  phone: string;
};

interface EmergencyParticipantPickerProps {
  emergencyPin: string;
  departments: Array<{ id: string; name: string }>;
  selectedSaved: SavedParticipantItem[];
  onSelectedSavedChange: (saved: SavedParticipantItem[]) => void;
  manualInvitees: ManualInviteeItem[];
  onManualInviteesChange: (invitees: ManualInviteeItem[]) => void;
  onError: (message: string) => void;
}

export function EmergencyParticipantPicker({
  emergencyPin,
  departments,
  selectedSaved,
  onSelectedSavedChange,
  manualInvitees,
  onManualInviteesChange,
  onError,
}: EmergencyParticipantPickerProps) {
  // Navigation tab: 'saved' | 'manual'
  const [activeTab, setActiveTab] = useState<'saved' | 'manual'>('saved');

  // Saved picker states
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [deptParticipants, setDeptParticipants] = useState<Array<{ id: string; name: string; maskedPhone: string }>>([]);
  const [isLoadingDept, setIsLoadingDept] = useState(false);
  const [deptFetchError, setDeptFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Cache for fetched department participants: deptId -> items
  const cacheRef = useRef<Record<string, Array<{ id: string; name: string; maskedPhone: string }>>>({});
  const lastFetchedPinRef = useRef<string>(emergencyPin.trim());
  const activeRequestIdRef = useRef<number>(0);

  // Manual entry states
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Filter out any emergency department from departments list if passed
  const availableDepartments = useMemo(() => {
    return departments.filter(d => d.name !== 'اجتماع طارئ');
  }, [departments]);

  // Total unique selections in client UI
  const totalSelected = useMemo(() => {
    return selectedSaved.length + manualInvitees.length;
  }, [selectedSaved.length, manualInvitees.length]);

  // If emergency PIN changes, clear search cache and reset fetched participants
  useEffect(() => {
    const currentPin = emergencyPin.trim();
    if (currentPin !== lastFetchedPinRef.current) {
      cacheRef.current = {};
      lastFetchedPinRef.current = currentPin;
      setDeptParticipants([]);
      setDeptFetchError(null);
      setSearchTerm('');
      // If PIN is cleared or changed, clear previous saved selections to avoid invalid PIN state
      onSelectedSavedChange([]);
    }
  }, [emergencyPin, onSelectedSavedChange]);

  // Fetch participants when selected department changes
  useEffect(() => {
    if (!selectedDeptId) {
      setDeptParticipants([]);
      setDeptFetchError(null);
      return;
    }

    const trimmedPin = emergencyPin.trim();
    if (!trimmedPin) {
      setDeptParticipants([]);
      setDeptFetchError('يرجى إدخال رمز الاجتماع الطارئ أولاً');
      return;
    }

    // Check cache
    if (cacheRef.current[selectedDeptId]) {
      setDeptParticipants(cacheRef.current[selectedDeptId]);
      setDeptFetchError(null);
      return;
    }

    const requestId = ++activeRequestIdRef.current;
    setIsLoadingDept(true);
    setDeptFetchError(null);

    fetch('/api/emergency-participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emergencyPin: trimmedPin,
        departmentId: selectedDeptId,
      }),
    })
      .then(async (res) => {
        if (requestId !== activeRequestIdRef.current) return; // Discard stale response
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'فشل في استرجاع المشاركين');
        }
        const items = Array.isArray(data.participants) ? data.participants : [];
        cacheRef.current[selectedDeptId] = items;
        setDeptParticipants(items);
        setDeptFetchError(null);
      })
      .catch((err: any) => {
        if (requestId !== activeRequestIdRef.current) return;
        setDeptParticipants([]);
        setDeptFetchError(err.message || 'تعذر جلب المشاركين لهذه الجهة');
      })
      .finally(() => {
        if (requestId === activeRequestIdRef.current) {
          setIsLoadingDept(false);
        }
      });
  }, [selectedDeptId, emergencyPin]);

  // Filtered department participants based on search
  const filteredParticipants = useMemo(() => {
    if (!searchTerm.trim()) return deptParticipants;
    const term = searchTerm.trim().toLowerCase();
    return deptParticipants.filter(p =>
      p.name.toLowerCase().includes(term) || p.maskedPhone.includes(term)
    );
  }, [deptParticipants, searchTerm]);

  // Selected department object
  const currentDept = useMemo(() => {
    return availableDepartments.find(d => d.id === selectedDeptId);
  }, [availableDepartments, selectedDeptId]);

  // Toggle selection for a saved participant
  const handleToggleSaved = (p: { id: string; name: string; maskedPhone: string }) => {
    const isSelected = selectedSaved.some(s => s.id === p.id);
    if (isSelected) {
      onSelectedSavedChange(selectedSaved.filter(s => s.id !== p.id));
    } else {
      if (totalSelected >= 15) {
        onError('تم الوصول إلى الحد الأقصى (15 مشاركاً)');
        return;
      }
      const deptName = currentDept?.name || 'جهة';
      onSelectedSavedChange([
        ...selectedSaved,
        {
          id: p.id,
          name: p.name,
          maskedPhone: p.maskedPhone,
          departmentName: deptName,
        },
      ]);
    }
  };

  // Add manual participant
  const handleAddManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (totalSelected >= 15) {
      onError('تم الوصول إلى الحد الأقصى (15 مشاركاً)');
      return;
    }

    const trimmedPhone = manualPhone.trim();
    if (!trimmedPhone) {
      onError('يرجى إدخال رقم هاتف المشارك');
      return;
    }

    const normalized = normalizeKuwaitiPhone(trimmedPhone);
    if (!normalized) {
      onError('رقم الهاتف غير صالح (يجب أن يكون رقماً كويتياً من 8 أرقام)');
      return;
    }

    // Check duplicate in manual list
    const isDuplicate = manualInvitees.some(m => {
      const norm = normalizeKuwaitiPhone(m.phone);
      return norm === normalized;
    });

    if (isDuplicate) {
      onError('تمت إضافة هذا الرقم مسبقاً في القائمة اليدوية');
      return;
    }

    const trimmedName = manualName.trim();
    if (trimmedName.length > 80) {
      onError('اسم المشارك لا يجب أن يتجاوز 80 حرفاً');
      return;
    }

    onManualInviteesChange([
      ...manualInvitees,
      {
        name: trimmedName,
        phone: trimmedPhone,
      },
    ]);

    setManualName('');
    setManualPhone('');
  };

  // Remove participant from final recipients list
  const handleRemoveSaved = (id: string) => {
    onSelectedSavedChange(selectedSaved.filter(s => s.id !== id));
  };

  const handleRemoveManual = (index: number) => {
    onManualInviteesChange(manualInvitees.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <div className="p-4 bg-[#f8f7f3] dark:bg-gray-800/60 border border-[#e6e2d8] dark:border-gray-700 rounded-2xl space-y-4 animate-fade-in text-right" dir="rtl">

        {/* Section Header + Total Counter */}
        <div className="flex items-center justify-between pb-2 border-b border-[#e6e2d8]/60 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-extrabold text-[#097834] flex items-center gap-1.5">
              <span>👥</span>
              <span>المشاركون في الاجتماع الطارئ</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              اختر المشاركين المحفوظين أو أضف مشاركين جدد
            </p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-900 border border-[#097834]/30 rounded-lg shadow-xs">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">الاختيارات:</span>
            <span className={`text-xs font-extrabold ${totalSelected >= 15 ? 'text-amber-600' : 'text-[#097834]'}`}>
              {totalSelected} من 15
            </span>
          </div>
        </div>

        {/* Tabs: Saved vs Manual */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'saved'
                ? 'bg-[#097834] !text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            المشاركون المحفوظون
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'manual'
                ? 'bg-[#097834] !text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            إضافة مشارك يدوياً
          </button>
        </div>

        {/* TAB 1: SAVED PARTICIPANTS */}
        {activeTab === 'saved' && (
          <div className="space-y-3">
            {!emergencyPin.trim() ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold text-center leading-relaxed">
                🔒 يرجى إدخال رمز الاجتماع الطارئ أعلاه لعرض واختيار المشاركين المحفوظين.
              </div>
            ) : (
              <>
                {/* Department Selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                    اختر الجهة:
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => {
                      setSelectedDeptId(e.target.value);
                      setSearchTerm('');
                    }}
                    className="w-full p-2.5 text-xs font-semibold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl outline-none focus:border-[#097834] focus:ring-1 focus:ring-[#097834] transition-all text-gray-800 dark:text-gray-100"
                  >
                    <option value="">-- اختر الجهة لاستعراض الأسماء --</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loading / Error States */}
                {isLoadingDept && (
                  <div className="py-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#097834] border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري تحميل المشاركين...</span>
                  </div>
                )}

                {deptFetchError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold text-center">
                    ⚠️ {deptFetchError}
                  </div>
                )}

                {/* Search & List of Department Participants */}
                {!isLoadingDept && !deptFetchError && selectedDeptId && (
                  <div className="space-y-2">
                    {deptParticipants.length > 0 ? (
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="بحث بالاسم أو الرقم المخفي..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pr-8 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-[#097834]"
                          />
                          <span className="absolute right-2.5 top-2.5 text-gray-400 text-xs">🔍</span>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 border border-gray-100 dark:border-gray-700/60 rounded-xl bg-white/60 dark:bg-gray-900/60">
                          {filteredParticipants.length === 0 ? (
                            <p className="py-3 text-center text-xs text-gray-400">لا توجد نتائج مطابقة للبحث</p>
                          ) : (
                            filteredParticipants.map((p) => {
                              const isChecked = selectedSaved.some(s => s.id === p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                                    isChecked
                                      ? 'bg-green-50/80 dark:bg-green-950/30 border-[#097834]/40 shadow-2xs'
                                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!isChecked && totalSelected >= 15}
                                      onChange={() => handleToggleSaved(p)}
                                      className="w-4 h-4 accent-[#097834] rounded cursor-pointer shrink-0"
                                    />
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                                      {p.name}
                                    </span>
                                  </div>
                                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 shrink-0 mr-2" dir="ltr">
                                    {p.maskedPhone}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="py-3 text-center text-xs text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        لا يوجد مشاركون نشطون مسجلون في هذه الجهة
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL ENTRY */}
        {activeTab === 'manual' && (
          <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                اسم المشارك (اختياري):
              </label>
              <input
                type="text"
                placeholder="مثال: د. محمد العلي"
                maxLength={80}
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:border-[#097834]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                رقم الهاتف الكويتي *:
              </label>
              <input
                type="tel"
                dir="ltr"
                placeholder="XXXXXXXX"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManual();
                  }
                }}
                className="w-full p-2 text-xs border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white text-left font-mono outline-none focus:border-[#097834]"
              />
            </div>
            <button
              type="button"
              disabled={totalSelected >= 15 || !manualPhone.trim()}
              onClick={() => handleAddManual()}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                totalSelected >= 15 || !manualPhone.trim()
                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 cursor-not-allowed'
                  : 'bg-[#097834] hover:bg-[#075f28] !text-white shadow-xs'
              }`}
            >
              <span>+</span>
              <span>إضافة للقائمة</span>
            </button>
          </div>
        )}

        {/* FINAL RECIPIENT LIST ("مستلمو رسائل هذا الاجتماع") */}
        <div className="pt-2 border-t border-[#e6e2d8]/60 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#097834] flex items-center gap-1">
              <span>📩</span>
              <span>مستلمو رسائل هذا الاجتماع:</span>
            </span>
            <span className="text-xs font-semibold text-gray-500">
              الاختيارات: {totalSelected}
            </span>
          </div>

          {totalSelected === 0 ? (
            <p className="p-3 text-center text-xs text-gray-400 bg-white dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 leading-relaxed">
              لم يتم اختيار أي مشارك حتى الآن. اختر من المشاركين المحفوظين أو أضف مشاركاً يدوياً.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 bg-white/70 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700">
              {/* Saved items */}
              {selectedSaved.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-2xs text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded shrink-0">
                      {s.departmentName}
                    </span>
                    <span className="font-bold text-gray-800 dark:text-gray-100 truncate">
                      {s.name}
                    </span>
                    <span className="text-gray-500 font-mono text-[11px]" dir="ltr">
                      {s.maskedPhone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSaved(s.id)}
                    className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded text-xs transition-colors shrink-0"
                    title="إزالة"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Manual items */}
              {manualInvitees.map((m, index) => (
                <div
                  key={`manual-${index}`}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-2xs text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded shrink-0">
                      يدوي
                    </span>
                    {m.name && (
                      <span className="font-bold text-gray-800 dark:text-gray-100 truncate">
                        {m.name}
                      </span>
                    )}
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-xs" dir="ltr">
                      {m.phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveManual(index)}
                    className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded text-xs transition-colors shrink-0"
                    title="إزالة"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
