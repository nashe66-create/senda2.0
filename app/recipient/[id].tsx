import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Smartphone,
  Building2,
  Wallet,
  Receipt,
  Trash2,
} from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import {
  Colors,
  Spacing,
  Typography,
  COUNTRIES,
  MOBILE_MONEY_PROVIDERS,
  RECEIVING_METHODS,
} from '@/lib/theme';
import {
  fetchRecipient,
  createRecipient,
  updateRecipient,
  deleteRecipient,
} from '@/lib/data';
import { ReceivingMethod, Recipient } from '@/types/database';

const methodIcons: Record<ReceivingMethod, typeof Smartphone> = {
  mobile_money: Smartphone,
  bank_account: Building2,
  cash_pickup: Wallet,
  bill_payment: Receipt,
};

export default function RecipientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [country, setCountry] = useState('NG');
  const [receivingMethod, setReceivingMethod] = useState<ReceivingMethod>('mobile_money');
  const [phone, setPhone] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [billType, setBillType] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const loadRecipient = useCallback(async () => {
    if (isNew || !id) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchRecipient(id);
      if (data) {
        setName(data.name);
        setCountry(data.country);
        setReceivingMethod(data.receiving_method);
        setPhone(data.phone);
        setMobileMoneyProvider(data.mobile_money_provider);
        setBankCode(data.bank_code);
        setAccountNumber(data.account_number);
        setBillType(data.bill_type);
        setRelationship(data.relationship);
        setNotes(data.notes);
      }
    } catch (e) {
      console.error('Failed to load recipient:', e);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useFocusEffect(
    useCallback(() => {
      loadRecipient();
    }, [loadRecipient])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a recipient name');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: Partial<Recipient> = {
        name: name.trim(),
        country,
        receiving_method: receivingMethod,
        phone: phone.trim(),
        mobile_money_provider: mobileMoneyProvider,
        bank_code: bankCode.trim(),
        account_number: accountNumber.trim(),
        bill_type: billType.trim(),
        relationship: relationship.trim(),
        notes: notes.trim(),
      };
      if (isNew) {
        await createRecipient(data);
      } else {
        await updateRecipient(id, data);
      }
      router.back();
    } catch (e: any) {
      setError(e.message || 'Failed to save recipient');
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipient',
      'Are you sure you want to delete this recipient?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecipient(id);
            router.back();
          },
        },
      ]
    );
  };

  if (loading) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.neutral[700]} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isNew ? 'Add Recipient' : 'Edit Recipient'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="Recipient name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. John Mukamuri"
            autoCapitalize="words"
          />

          <Input
            label="Relationship (optional)"
            value={relationship}
            onChangeText={setRelationship}
            placeholder="e.g. family, friend"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Country</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.countryScroll}
            contentContainerStyle={styles.countryScrollContent}
          >
            {COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                onPress={() => setCountry(c.code)}
                style={[
                  styles.countryChip,
                  country === c.code && styles.countryChipSelected,
                ]}
              >
                <Text style={styles.countryFlag}>{c.flag}</Text>
                <Text
                  style={[
                    styles.countryChipText,
                    country === c.code && styles.countryChipTextSelected,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Receiving method</Text>
          <View style={styles.methodRow}>
            {RECEIVING_METHODS.map((m) => {
              const Icon = methodIcons[m.value];
              const isSelected = receivingMethod === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setReceivingMethod(m.value)}
                  style={[
                    styles.methodChip,
                    isSelected && styles.methodChipSelected,
                  ]}
                >
                  <Icon
                    color={isSelected ? Colors.primary[600] : Colors.neutral[500]}
                    size={18}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.methodChipText,
                      isSelected && styles.methodChipTextSelected,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {receivingMethod === 'mobile_money' && (
            <>
              <Text style={styles.label}>Mobile money provider</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.providerScroll}
                contentContainerStyle={styles.providerScrollContent}
              >
                {MOBILE_MONEY_PROVIDERS.map((p) => (
                  <TouchableOpacity
                    key={p.code}
                    onPress={() => setMobileMoneyProvider(p.code)}
                    style={[
                      styles.providerChip,
                      mobileMoneyProvider === p.code && styles.providerChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.providerChipText,
                        mobileMoneyProvider === p.code && styles.providerChipTextSelected,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Input
                label="Recipient phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="+263 77 123 4567"
                keyboardType="phone-pad"
              />
            </>
          )}

          {receivingMethod === 'bank_account' && (
            <>
              <Input
                label="Bank code (Flutterwave)"
                value={bankCode}
                onChangeText={setBankCode}
                placeholder="e.g. 044"
              />
              <Input
                label="Account number"
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="0123456789"
                keyboardType="numeric"
              />
            </>
          )}

          {receivingMethod === 'cash_pickup' && (
            <Input
              label="Recipient phone (for pickup code)"
              value={phone}
              onChangeText={setPhone}
              placeholder="+263 77 123 4567"
              keyboardType="phone-pad"
            />
          )}

          {receivingMethod === 'bill_payment' && (
            <Input
              label="Bill type"
              value={billType}
              onChangeText={setBillType}
              placeholder="e.g. electricity, water, DSTV"
              autoCapitalize="words"
            />
          )}

          <Input
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details"
            autoCapitalize="sentences"
          />

          <Button
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          >
            {isNew ? 'Add Recipient' : 'Save Changes'}
          </Button>

          {!isNew && (
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.deleteBtn}
            >
              <Trash2 color={Colors.error[500]} size={16} strokeWidth={2} />
              <Text style={styles.deleteBtnText}>Delete Recipient</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.neutral[900],
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    backgroundColor: '#fff',
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  errorBox: {
    backgroundColor: Colors.error[50],
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error[700],
  },
  label: {
    ...Typography.label,
    color: Colors.neutral[700],
    marginBottom: Spacing.sm,
  },
  countryScroll: {
    marginBottom: Spacing.md,
  },
  countryScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 999,
  },
  countryChipSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  countryFlag: {
    fontSize: 18,
  },
  countryChipText: {
    ...Typography.caption,
    color: Colors.neutral[600],
  },
  countryChipTextSelected: {
    color: Colors.primary[700],
    fontFamily: 'Inter-SemiBold',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 12,
  },
  methodChipSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  methodChipText: {
    ...Typography.caption,
    color: Colors.neutral[600],
  },
  methodChipTextSelected: {
    color: Colors.primary[700],
    fontFamily: 'Inter-SemiBold',
  },
  providerScroll: {
    marginBottom: Spacing.md,
  },
  providerScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  providerChip: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 999,
  },
  providerChipSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  providerChipText: {
    ...Typography.caption,
    color: Colors.neutral[600],
  },
  providerChipTextSelected: {
    color: Colors.primary[700],
    fontFamily: 'Inter-SemiBold',
  },
  saveBtn: {
    marginTop: Spacing.lg,
    width: '100%',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    paddingVertical: 14,
  },
  deleteBtnText: {
    ...Typography.bodyMedium,
    color: Colors.error[600],
  },
});
