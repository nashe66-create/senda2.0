import {
  useState,
  useCallback,
  useEffect,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

import {
  useLocalSearchParams,
  router,
  useFocusEffect,
} from 'expo-router';

import {
  ArrowLeft,
  Smartphone,
  Building2,
  Wallet,
  Receipt,
  Trash2,
  RefreshCw,
} from 'lucide-react-native';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';

import {
  Colors,
  Spacing,
  Typography,
  RECEIVING_METHODS,
} from '@/lib/theme';

import {
  fetchRecipient,
  createRecipient,
  updateRecipient,
  deleteRecipient,
  fetchFlutterwaveOptions,
  fetchFlutterwaveCountryOptions,
} from '@/lib/data';

import {
  ReceivingMethod,
  Recipient,
  FlutterwaveOptions,
  FlutterwaveCurrency,
  FlutterwaveMobileNetwork,
  FlutterwaveBank,
  FlutterwaveCountry,
} from '@/types/database';

/* =========================================================
   ICONS
   ========================================================= */

const methodIcons: Record<
  ReceivingMethod,
  typeof Smartphone
> = {
  mobile_money: Smartphone,
  bank_account: Building2,
  cash_pickup: Wallet,
  bill_payment: Receipt,
};

/* =========================================================
   SAFE HELPERS
   ========================================================= */

function safeArray<T>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? value as T[]
    : [];
}

function stringValue(
  value: unknown
): string {
  if (
    typeof value === 'string'
  ) {
    return value.trim();
  }

  if (
    typeof value === 'number'
  ) {
    return String(value);
  }

  return '';
}

function uniqueKey(
  prefix: string,
  item: any,
  index: number
): string {
  const id =
    stringValue(item?.id);

  const code =
    stringValue(item?.code);

  const name =
    stringValue(item?.name);

  return [
    prefix,
    id || 'no-id',
    code || 'no-code',
    name || 'no-name',
    index,
  ].join('-');
}

function getItemCode(
  item: any
): string {
  return (
    stringValue(item?.code) ||
    stringValue(item?.id)
  );
}

function getItemName(
  item: any
): string {
  return (
    stringValue(item?.name) ||
    getItemCode(item)
  );
}

/* =========================================================
   SCREEN
   ========================================================= */

export default function RecipientDetailScreen() {
  const {
    id,
  } =
    useLocalSearchParams<{
      id: string;
    }>();

  const isNew =
    id === 'new';

  /* =======================================================
     RECIPIENT
     ======================================================= */

  const [
    name,
    setName,
  ] = useState('');

  const [
    country,
    setCountry,
  ] = useState('');

  const [
    currency,
    setCurrency,
  ] = useState('');

  const [
    receivingMethod,
    setReceivingMethod,
  ] =
    useState<ReceivingMethod>(
      'mobile_money'
    );

  const [
    phone,
    setPhone,
  ] = useState('');

  const [
    mobileMoneyProvider,
    setMobileMoneyProvider,
  ] = useState('');

  const [
    bankCode,
    setBankCode,
  ] = useState('');

  const [
    accountNumber,
    setAccountNumber,
  ] = useState('');

  const [
    billType,
    setBillType,
  ] = useState('');

  const [
    relationship,
    setRelationship,
  ] = useState('');

  const [
    notes,
    setNotes,
  ] = useState('');

  /* =======================================================
     FLUTTERWAVE IDS
     ======================================================= */

  const [
    flutterwaveRecipientId,
    setFlutterwaveRecipientId,
  ] =
    useState<string | null>(
      null
    );

  const [
    flutterwaveNetworkCode,
    setFlutterwaveNetworkCode,
  ] =
    useState<string | null>(
      null
    );

  const [
    flutterwaveBankName,
    setFlutterwaveBankName,
  ] =
    useState<string | null>(
      null
    );

  /* =======================================================
     OPTIONS
     ======================================================= */

  const [
    options,
    setOptions,
  ] =
    useState<FlutterwaveOptions | null>(
      null
    );

  const [
    optionsLoading,
    setOptionsLoading,
  ] =
    useState(false);

  const [
    optionsError,
    setOptionsError,
  ] =
    useState<string | null>(
      null
    );

  /* =======================================================
     GENERAL
     ======================================================= */

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(!isNew);

  /* =======================================================
     NORMALISE OPTIONS
     ======================================================= */

  const normaliseOptions = (
    value: FlutterwaveOptions
  ): FlutterwaveOptions => {
    return {
      ...value,

      countries:
        safeArray<FlutterwaveCountry>(
          value?.countries
        ),

      currencies:
        safeArray<FlutterwaveCurrency>(
          value?.currencies
        ),

      mobile_networks:
        safeArray<FlutterwaveMobileNetwork>(
          value?.mobile_networks
        ),

      banks:
        safeArray<FlutterwaveBank>(
          value?.banks
        ),

      payout_methods:
        safeArray<string>(
          value?.payout_methods
        ),
    };
  };

  /* =======================================================
     LOAD ALL DESTINATIONS
     ======================================================= */

  const loadAllOptions =
    useCallback(
      async () => {
        setOptionsLoading(
          true
        );

        setOptionsError(
          null
        );

        try {
          const data =
            await fetchFlutterwaveOptions();

          setOptions(
            normaliseOptions(
              data
            )
          );
        } catch (e: any) {
          console.error(
            'Failed to load Flutterwave destinations:',
            e
          );

          setOptions(
            null
          );

          setOptionsError(
            e?.message ||
              'Unable to load payout destinations'
          );
        } finally {
          setOptionsLoading(
            false
          );
        }
      },
      []
    );

  /* =======================================================
     LOAD COUNTRY OPTIONS
     ======================================================= */

  const loadCountryOptions =
    useCallback(
      async (
        selectedCountry: string
      ) => {
        if (
          !selectedCountry
        ) {
          return;
        }

        setOptionsLoading(
          true
        );

        setOptionsError(
          null
        );

        try {
          const data =
            await fetchFlutterwaveCountryOptions(
              selectedCountry
            );

          setOptions(
            normaliseOptions(
              data
            )
          );

          /*
           * If Flutterwave supplies only one
           * destination currency, use it
           * automatically.
           */
          const currencies =
            safeArray<FlutterwaveCurrency>(
              data?.currencies
            );

          if (
            currencies.length ===
            1
          ) {
            const code =
              stringValue(
                currencies[0]?.code
              );

            if (code) {
              setCurrency(
                code
              );
            }
          }
        } catch (e: any) {
          console.error(
            'Failed to load country options:',
            e
          );

          setOptionsError(
            e?.message ||
              'Unable to load payout options'
          );

          setOptions(
            null
          );
        } finally {
          setOptionsLoading(
            false
          );
        }
      },
      []
    );

  /* =======================================================
     LOAD EXISTING RECIPIENT
     ======================================================= */

  const loadRecipient =
    useCallback(
      async () => {
        if (
          isNew ||
          !id
        ) {
          setLoading(
            false
          );

          return;
        }

        try {
          const data =
            await fetchRecipient(
              id
            );

          if (data) {
            setName(
              data.name
            );

            setCountry(
              data.country
            );

            setCurrency(
              data.currency ||
                ''
            );

            setReceivingMethod(
              data.receiving_method
            );

            setPhone(
              data.phone ||
                ''
            );

            setMobileMoneyProvider(
              data.mobile_money_provider ||
                ''
            );

            setBankCode(
              data.bank_code ||
                ''
            );

            setAccountNumber(
              data.account_number ||
                ''
            );

            setBillType(
              data.bill_type ||
                ''
            );

            setRelationship(
              data.relationship ||
                ''
            );

            setNotes(
              data.notes ||
                ''
            );

            setFlutterwaveRecipientId(
              data.flutterwave_recipient_id ??
                null
            );

            setFlutterwaveNetworkCode(
              data.flutterwave_network_code ??
                null
            );

            setFlutterwaveBankName(
              data.flutterwave_bank_name ??
                null
            );

            await loadCountryOptions(
              data.country
            );
          }
        } catch (e) {
          console.error(
            'Failed to load recipient:',
            e
          );

          setError(
            'Failed to load recipient'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        id,
        isNew,
        loadCountryOptions,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        loadRecipient();
      },
      [
        loadRecipient,
      ]
    )
  );

  /* =======================================================
     LOAD DESTINATIONS FOR NEW RECIPIENT
     ======================================================= */

  useEffect(
    () => {
      if (isNew) {
        loadAllOptions();
      }
    },
    [
      isNew,
      loadAllOptions,
    ]
  );

  /* =======================================================
     DESTINATIONS
     ======================================================= */

  const countries =
    safeArray<FlutterwaveCountry>(
      options?.countries
    );

  const currencies =
    safeArray<FlutterwaveCurrency>(
      options?.currencies
    );

  const mobileNetworks =
    safeArray<FlutterwaveMobileNetwork>(
      options?.mobile_networks
    );

  const banks =
    safeArray<FlutterwaveBank>(
      options?.banks
    );

  const payoutMethods =
    safeArray<string>(
      options?.payout_methods
    );

  /* =======================================================
     SELECT COUNTRY
     ======================================================= */

  const handleCountryChange =
    async (
      newCountry: string
    ) => {
      if (
        !newCountry ||
        newCountry === country
      ) {
        return;
      }

      setCountry(
        newCountry
      );

      setCurrency(
        ''
      );

      setMobileMoneyProvider(
        ''
      );

      setBankCode(
        ''
      );

      setFlutterwaveNetworkCode(
        null
      );

      setFlutterwaveBankName(
        null
      );

      setFlutterwaveRecipientId(
        null
      );

      await loadCountryOptions(
        newCountry
      );
    };

  /* =======================================================
     SELECT METHOD
     ======================================================= */

  const handleReceivingMethodChange =
    (
      method: ReceivingMethod
    ) => {
      setReceivingMethod(
        method
      );

      if (
        method !==
        'mobile_money'
      ) {
        setMobileMoneyProvider(
          ''
        );

        setFlutterwaveNetworkCode(
          null
        );
      }

      if (
        method !==
        'bank_account'
      ) {
        setBankCode(
          ''
        );

        setFlutterwaveBankName(
          null
        );
      }
    };

  /* =======================================================
     SELECT CURRENCY
     ======================================================= */

  const handleCurrencyChange =
    (
      selectedCurrency: string
    ) => {
      setCurrency(
        selectedCurrency
      );

      setMobileMoneyProvider(
        ''
      );

      setBankCode(
        ''
      );

      setFlutterwaveNetworkCode(
        null
      );

      setFlutterwaveBankName(
        null
      );

      setFlutterwaveRecipientId(
        null
      );
    };

  /* =======================================================
     SELECT MOBILE NETWORK
     ======================================================= */

  const handleMobileNetworkSelect =
    (
      network: FlutterwaveMobileNetwork
    ) => {
      const code =
        getItemCode(
          network
        );

      const name =
        getItemName(
          network
        );

      if (!code) {
        setError(
          'This mobile network is not available'
        );

        return;
      }

      /*
       * IMPORTANT:
       * Only this one network is selected.
       */
      setFlutterwaveNetworkCode(
        code
      );

      setMobileMoneyProvider(
        name
      );

      setFlutterwaveRecipientId(
        null
      );

      setError(
        null
      );

      /*
       * If network contains a currency
       * and we don't already have one,
       * automatically use it.
       */
      const networkCurrency =
        stringValue(
          network?.currency
        );

      if (
        !currency &&
        networkCurrency
      ) {
        setCurrency(
          networkCurrency
        );
      }
    };

  /* =======================================================
     SELECT BANK
     ======================================================= */

  const handleBankSelect =
    (
      bank: FlutterwaveBank
    ) => {
      const code =
        getItemCode(
          bank
        );

      const name =
        getItemName(
          bank
        );

      if (!code) {
        setError(
          'This bank is not available'
        );

        return;
      }

      setBankCode(
        code
      );

      setFlutterwaveBankName(
        name
      );

      setFlutterwaveRecipientId(
        null
      );

      setError(
        null
      );

      const bankCurrency =
        stringValue(
          bank?.currency
        );

      if (
        !currency &&
        bankCurrency
      ) {
        setCurrency(
          bankCurrency
        );
      }
    };

  /* =======================================================
     SAVE
     ======================================================= */

  const handleSave =
    async () => {
      setError(
        null
      );

      if (
        !name.trim()
      ) {
        setError(
          'Please enter a recipient name'
        );

        return;
      }

      if (
        !country
      ) {
        setError(
          'Please select a destination country'
        );

        return;
      }

      /*
       * Currency is only required when Flutterwave
       * actually provides currency choices.
       *
       * If there is no currency list, we don't
       * ask the user to select one.
       */
      if (
        currencies.length > 0 &&
        !currency
      ) {
        setError(
          'Please select a currency'
        );

        return;
      }

      if (
        receivingMethod ===
        'mobile_money'
      ) {
        if (
          !mobileMoneyProvider ||
          !flutterwaveNetworkCode
        ) {
          setError(
            'Please select a mobile money provider'
          );

          return;
        }

        if (
          !phone.trim()
        ) {
          setError(
            'Please enter the recipient phone number'
          );

          return;
        }
      }

      if (
        receivingMethod ===
        'bank_account'
      ) {
        if (
          !bankCode
        ) {
          setError(
            'Please select a bank'
          );

          return;
        }

        if (
          !accountNumber.trim()
        ) {
          setError(
            'Please enter the account number'
          );

          return;
        }
      }

      setSaving(
        true
      );

      try {
        const data:
          Partial<Recipient> =
          {
            name:
              name.trim(),

            country,

            /*
             * If no currency is returned by Flutterwave,
             * save null/empty rather than inventing one.
             */
            currency:
              currency ||
              null,

            receiving_method:
              receivingMethod,

            phone:
              phone.trim(),

            mobile_money_provider:
              mobileMoneyProvider,

            bank_code:
              bankCode.trim(),

            account_number:
              accountNumber.trim(),

            bill_type:
              billType.trim(),

            relationship:
              relationship.trim(),

            notes:
              notes.trim(),

            flutterwave_recipient_id:
              flutterwaveRecipientId,

            flutterwave_network_code:
              flutterwaveNetworkCode,

            flutterwave_bank_name:
              flutterwaveBankName,
          };

        if (isNew) {
          await createRecipient(
            data
          );
        } else {
          await updateRecipient(
            id,
            data
          );
        }

        router.back();
      } catch (e: any) {
        console.error(
          'Failed to save recipient:',
          e
        );

        setError(
          e?.message ||
            'Failed to save recipient'
        );

        setSaving(
          false
        );
      }
    };

  /* =======================================================
     DELETE
     ======================================================= */

  const handleDelete =
    () => {
      Alert.alert(
        'Delete Recipient',
        'Are you sure you want to delete this recipient?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Delete',
            style: 'destructive',

            onPress:
              async () => {
                try {
                  await deleteRecipient(
                    id
                  );

                  router.back();
                } catch (
                  e: any
                ) {
                  setError(
                    e?.message ||
                      'Failed to delete recipient'
                  );
                }
              },
          },
        ]
      );
    };

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return <Loading />;
  }

  /* =======================================================
     FILTER OPTIONS
     ======================================================= */

  const filteredMobileNetworks =
    mobileNetworks.filter(
      (
        network
      ) => {
        if (
          !currency
        ) {
          return true;
        }

        const networkCurrency =
          stringValue(
            network?.currency
          );

        if (
          !networkCurrency
        ) {
          return true;
        }

        return (
          networkCurrency.toUpperCase() ===
          currency.toUpperCase()
        );
      }
    );

  const filteredBanks =
    banks.filter(
      (bank) => {
        if (
          !currency
        ) {
          return true;
        }

        const bankCurrency =
          stringValue(
            bank?.currency
          );

        if (
          !bankCurrency
        ) {
          return true;
        }

        return (
          bankCurrency.toUpperCase() ===
          currency.toUpperCase()
        );
      }
    );

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
      }
    >
      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={
            styles.backBtn
          }
        >
          <ArrowLeft
            color={
              Colors
                .neutral[700]
            }
            size={24}
          />
        </TouchableOpacity>

        <Text
          style={
            styles.headerTitle
          }
        >
          {isNew
            ? 'Add Recipient'
            : 'Edit Recipient'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.form
          }
        >
          {/* ERROR */}

          {error && (
            <View
              style={
                styles.errorBox
              }
            >
              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            </View>
          )}

          {/* NAME */}

          <Input
            label="Recipient name"
            value={name}
            onChangeText={
              setName
            }
            placeholder="e.g. John Mukamuri"
            autoCapitalize="words"
          />

          {/* RELATIONSHIP */}

          <Input
            label="Relationship (optional)"
            value={
              relationship
            }
            onChangeText={
              setRelationship
            }
            placeholder="e.g. family, friend"
            autoCapitalize="words"
          />

          {/* DESTINATION COUNTRY */}

          <Text
            style={
              styles.label
            }
          >
            Destination country
          </Text>

          {optionsLoading &&
            countries.length ===
              0 && (
              <Text
                style={
                  styles.mutedText
                }
              >
                Loading available destinations...
              </Text>
            )}

          {!optionsLoading &&
            countries.length ===
              0 && (
              <View
                style={
                  styles.emptyOptionsBox
                }
              >
                <Text
                  style={
                    styles.emptyOptionsText
                  }
                >
                  No payout destinations are currently available.
                </Text>
              </View>
            )}

          {countries.length >
            0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              style={
                styles.countryScroll
              }
              contentContainerStyle={
                styles.countryScrollContent
              }
            >
              {countries.map(
                (
                  item,
                  index
                ) => {
                  const code =
                    getItemCode(
                      item
                    );

                  const name =
                    getItemName(
                      item
                    );

                  if (!code)
                    return null;

                  const selected =
                    country.toUpperCase() ===
                    code.toUpperCase();

                  return (
                    <TouchableOpacity
                      key={uniqueKey(
                        'country',
                        item,
                        index
                      )}
                      onPress={() =>
                        handleCountryChange(
                          code
                        )
                      }
                      style={[
                        styles.countryChip,

                        selected &&
                          styles.countryChipSelected,
                      ]}
                    >
                      <Text
                        style={
                          styles.countryChipText
                        }
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>
          )}

          {/* COUNTRY ERROR */}

          {optionsError &&
            !optionsLoading && (
              <TouchableOpacity
                onPress={() => {
                  if (
                    country
                  ) {
                    loadCountryOptions(
                      country
                    );
                  } else {
                    loadAllOptions();
                  }
                }}
                style={
                  styles.optionsErrorBox
                }
              >
                <RefreshCw
                  color={
                    Colors
                      .error[600]
                  }
                  size={18}
                />

                <View
                  style={
                    styles.optionsErrorContent
                  }
                >
                  <Text
                    style={
                      styles.optionsErrorTitle
                    }
                  >
                    Unable to load payout options
                  </Text>

                  <Text
                    style={
                      styles.optionsErrorText
                    }
                  >
                    Tap to try again
                  </Text>
                </View>
              </TouchableOpacity>
            )}

          {/* COUNTRY OPTIONS LOADING */}

          {country &&
            optionsLoading && (
            <View
              style={
                styles.optionsLoadingBox
              }
            >
              <Text
                style={
                  styles.optionsLoadingText
                }
              >
                Loading available payout options...
              </Text>
            </View>
          )}

          {/* CURRENCY */}

          {country &&
            currencies.length >
              0 && (
              <>
                <Text
                  style={
                    styles.label
                  }
                >
                  Currency
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  style={
                    styles.currencyScroll
                  }
                  contentContainerStyle={
                    styles.currencyScrollContent
                  }
                >
                  {currencies.map(
                    (
                      item,
                      index
                    ) => {
                      const code =
                        stringValue(
                          item?.code
                        );

                      if (!code)
                        return null;

                      const selected =
                        currency.toUpperCase() ===
                        code.toUpperCase();

                      return (
                        <TouchableOpacity
                          key={uniqueKey(
                            'currency',
                            item,
                            index
                          )}
                          onPress={() =>
                            handleCurrencyChange(
                              code
                            )
                          }
                          style={[
                            styles.currencyChip,

                            selected &&
                              styles.currencyChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.currencyChipText,

                              selected &&
                                styles.currencyChipTextSelected,
                            ]}
                          >
                            {code}
                          </Text>

                          {item?.name && (
                            <Text
                              style={
                                styles.currencyName
                              }
                            >
                              {
                                item.name
                              }
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    }
                  )}
                </ScrollView>
              </>
            )}

          {/* RECEIVING METHOD */}

          <Text
            style={
              styles.label
            }
          >
            Receiving method
          </Text>

          <View
            style={
              styles.methodRow
            }
          >
            {RECEIVING_METHODS.map(
              (
                method
              ) => {
                const Icon =
                  methodIcons[
                    method.value
                  ];

                const selected =
                  receivingMethod ===
                  method.value;

                return (
                  <TouchableOpacity
                    key={
                      method.value
                    }
                    onPress={() =>
                      handleReceivingMethodChange(
                        method.value
                      )
                    }
                    style={[
                      styles.methodChip,

                      selected &&
                        styles.methodChipSelected,
                    ]}
                  >
                    <Icon
                      color={
                        selected
                          ? Colors
                              .primary[600]
                          : Colors
                              .neutral[500]
                      }
                      size={18}
                    />

                    <Text
                      style={[
                        styles.methodChipText,

                        selected &&
                          styles.methodChipTextSelected,
                      ]}
                    >
                      {
                        method.label
                      }
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>

          {/* =================================================
              MOBILE MONEY
              ================================================= */}

          {receivingMethod ===
            'mobile_money' && (
            <>
              <Text
                style={
                  styles.label
                }
              >
                Mobile money provider
              </Text>

              {filteredMobileNetworks.length ===
                0 ? (
                <View
                  style={
                    styles.emptyOptionsBox
                  }
                >
                  <Text
                    style={
                      styles.emptyOptionsText
                    }
                  >
                    No mobile money providers are currently available for this destination.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  style={
                    styles.providerScroll
                  }
                  contentContainerStyle={
                    styles.providerScrollContent
                  }
                >
                  {filteredMobileNetworks.map(
                    (
                      network,
                      index
                    ) => {
                      const code =
                        getItemCode(
                          network
                        );

                      const name =
                        getItemName(
                          network
                        );

                      if (
                        !code
                      ) {
                        return null;
                      }

                      const selected =
                        flutterwaveNetworkCode ===
                        code;

                      return (
                        <TouchableOpacity
                          key={uniqueKey(
                            'mobile-network',
                            network,
                            index
                          )}
                          onPress={() =>
                            handleMobileNetworkSelect(
                              network
                            )
                          }
                          style={[
                            styles.providerChip,

                            selected &&
                              styles.providerChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.providerChipText,

                              selected &&
                                styles.providerChipTextSelected,
                            ]}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </ScrollView>
              )}

              <Input
                label="Recipient phone number"
                value={phone}
                onChangeText={
                  setPhone
                }
                placeholder="+263 77 123 4567"
                keyboardType="phone-pad"
              />
            </>
          )}

          {/* =================================================
              BANK
              ================================================= */}

          {receivingMethod ===
            'bank_account' && (
            <>
              <Text
                style={
                  styles.label
                }
              >
                Bank
              </Text>

              {filteredBanks.length ===
                0 ? (
                <View
                  style={
                    styles.emptyOptionsBox
                  }
                >
                  <Text
                    style={
                      styles.emptyOptionsText
                    }
                  >
                    No banks are currently available for this destination.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  style={
                    styles.providerScroll
                  }
                  contentContainerStyle={
                    styles.providerScrollContent
                  }
                >
                  {filteredBanks.map(
                    (
                      bank,
                      index
                    ) => {
                      const code =
                        getItemCode(
                          bank
                        );

                      const name =
                        getItemName(
                          bank
                        );

                      if (
                        !code
                      ) {
                        return null;
                      }

                      const selected =
                        bankCode ===
                        code;

                      return (
                        <TouchableOpacity
                          key={uniqueKey(
                            'bank',
                            bank,
                            index
                          )}
                          onPress={() =>
                            handleBankSelect(
                              bank
                            )
                          }
                          style={[
                            styles.providerChip,

                            selected &&
                              styles.providerChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.providerChipText,

                              selected &&
                                styles.providerChipTextSelected,
                            ]}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </ScrollView>
              )}

              <Input
                label="Account number"
                value={
                  accountNumber
                }
                onChangeText={
                  setAccountNumber
                }
                placeholder="0123456789"
                keyboardType="numeric"
              />
            </>
          )}

          {/* =================================================
              CASH
              ================================================= */}

          {receivingMethod ===
            'cash_pickup' && (
            <Input
              label="Recipient phone"
              value={phone}
              onChangeText={
                setPhone
              }
              placeholder="+263 77 123 4567"
              keyboardType="phone-pad"
            />
          )}

          {/* =================================================
              BILL
              ================================================= */}

          {receivingMethod ===
            'bill_payment' && (
            <Input
              label="Bill type"
              value={
                billType
              }
              onChangeText={
                setBillType
              }
              placeholder="e.g. electricity, water, DSTV"
              autoCapitalize="words"
            />
          )}

          {/* NOTES */}

          <Input
            label="Notes (optional)"
            value={
              notes
            }
            onChangeText={
              setNotes
            }
            placeholder="Any additional details"
            autoCapitalize="sentences"
          />

          {/* SAVE */}

          <Button
            onPress={
              handleSave
            }
            loading={
              saving
            }
            style={
              styles.saveBtn
            }
          >
            {isNew
              ? 'Add Recipient'
              : 'Save Changes'}
          </Button>

          {/* DELETE */}

          {!isNew && (
            <TouchableOpacity
              onPress={
                handleDelete
              }
              style={
                styles.deleteBtn
              }
            >
              <Trash2
                color={
                  Colors
                    .error[500]
                }
                size={16}
              />

              <Text
                style={
                  styles.deleteBtnText
                }
              >
                Delete Recipient
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        Colors.neutral[50],
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: Spacing.sm,
      paddingTop: 60,
      paddingHorizontal:
        Spacing.md,
      paddingBottom:
        Spacing.sm,
    },

    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        '#fff',
      alignItems:
        'center',
      justifyContent:
        'center',
      elevation: 2,
    },

    headerTitle: {
      ...Typography.h2,
      color:
        Colors.neutral[900],
    },

    scrollContent: {
      flexGrow: 1,
    },

    form: {
      backgroundColor:
        '#fff',
      flex: 1,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      paddingHorizontal:
        Spacing.lg,
      paddingTop:
        Spacing.xl,
      paddingBottom:
        Spacing.xxl,
    },

    errorBox: {
      backgroundColor:
        Colors.error[50],
      borderRadius: 12,
      padding:
        Spacing.md,
      marginBottom:
        Spacing.md,
    },

    errorText: {
      ...Typography.caption,
      color:
        Colors.error[700],
    },

    label: {
      ...Typography.label,
      color:
        Colors.neutral[700],
      marginBottom:
        Spacing.sm,
      marginTop:
        Spacing.sm,
    },

    mutedText: {
      ...Typography.small,
      color:
        Colors.neutral[500],
      marginBottom:
        Spacing.md,
    },

    countryScroll: {
      marginBottom:
        Spacing.md,
    },

    countryScrollContent: {
      gap: Spacing.sm,
      paddingRight:
        Spacing.lg,
    },

    countryChip: {
      paddingVertical: 10,
      paddingHorizontal:
        Spacing.md,
      borderWidth: 1.5,
      borderColor:
        Colors.neutral[300],
      borderRadius: 999,
    },

    countryChipSelected: {
      borderColor:
        Colors.primary[600],
      backgroundColor:
        Colors.primary[50],
    },

    countryChipText: {
      ...Typography.caption,
      color:
        Colors.neutral[700],
    },

    currencyScroll: {
      marginBottom:
        Spacing.md,
    },

    currencyScrollContent: {
      gap: Spacing.sm,
      paddingRight:
        Spacing.lg,
    },

    currencyChip: {
      minWidth: 90,
      paddingVertical: 10,
      paddingHorizontal:
        Spacing.md,
      borderWidth: 1.5,
      borderColor:
        Colors.neutral[300],
      borderRadius: 12,
    },

    currencyChipSelected: {
      borderColor:
        Colors.primary[600],
      backgroundColor:
        Colors.primary[50],
    },

    currencyChipText: {
      ...Typography.bodyMedium,
      color:
        Colors.neutral[700],
    },

    currencyChipTextSelected: {
      color:
        Colors.primary[700],
    },

    currencyName: {
      ...Typography.small,
      color:
        Colors.neutral[500],
      marginTop: 2,
    },

    methodRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: Spacing.sm,
      marginBottom:
        Spacing.md,
    },

    methodChip: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal:
        Spacing.md,
      borderWidth: 1.5,
      borderColor:
        Colors.neutral[300],
      borderRadius: 12,
    },

    methodChipSelected: {
      borderColor:
        Colors.primary[600],
      backgroundColor:
        Colors.primary[50],
    },

    methodChipText: {
      ...Typography.caption,
      color:
        Colors.neutral[600],
    },

    methodChipTextSelected: {
      color:
        Colors.primary[700],
      fontFamily:
        'Inter-SemiBold',
    },

    providerScroll: {
      marginBottom:
        Spacing.md,
    },

    providerScrollContent: {
      gap: Spacing.sm,
      paddingRight:
        Spacing.lg,
    },

    providerChip: {
      paddingVertical: 10,
      paddingHorizontal:
        Spacing.md,
      borderWidth: 1.5,
      borderColor:
        Colors.neutral[300],
      borderRadius: 999,
    },

    providerChipSelected: {
      borderColor:
        Colors.primary[600],
      backgroundColor:
        Colors.primary[50],
    },

    providerChipText: {
      ...Typography.caption,
      color:
        Colors.neutral[600],
    },

    providerChipTextSelected: {
      color:
        Colors.primary[700],
      fontFamily:
        'Inter-SemiBold',
    },

    optionsLoadingBox: {
      backgroundColor:
        Colors.primary[50],
      borderRadius: 12,
      padding:
        Spacing.md,
      marginBottom:
        Spacing.md,
    },

    optionsLoadingText: {
      ...Typography.small,
      color:
        Colors.primary[700],
    },

    optionsErrorBox: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: Spacing.sm,
      backgroundColor:
        Colors.error[50],
      borderRadius: 12,
      padding:
        Spacing.md,
      marginBottom:
        Spacing.md,
    },

    optionsErrorContent: {
      flex: 1,
    },

    optionsErrorTitle: {
      ...Typography.caption,
      color:
        Colors.error[700],
    },

    optionsErrorText: {
      ...Typography.small,
      color:
        Colors.error[600],
      marginTop: 2,
    },

    emptyOptionsBox: {
      backgroundColor:
        Colors.neutral[50],
      borderRadius: 12,
      padding:
        Spacing.md,
      marginBottom:
        Spacing.md,
    },

    emptyOptionsText: {
      ...Typography.small,
      color:
        Colors.neutral[500],
    },

    saveBtn: {
      marginTop:
        Spacing.lg,
      width: '100%',
    },

    deleteBtn: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      marginTop:
        Spacing.lg,
      paddingVertical: 14,
    },

    deleteBtnText: {
      ...Typography.bodyMedium,
      color:
        Colors.error[600],
    },
  });