// =============================================================================
// Utility: PDF Generator (Client-Side Preview)
// Issue: #4048 - Implement 'Automated "Event Series" Certificate Generation'
// Description: Uses @react-pdf/renderer to define the certificate template.
// This component can be used for client-side preview or passed to a Node 
// microservice for actual PDF generation.
// =============================================================================

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 40,
        fontFamily: 'Helvetica',
    },
    border: {
        borderWidth: 4,
        borderColor: '#4F46E5',
        padding: 20,
        height: '100%',
    },
    header: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 2,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: '#4B5563',
        textAlign: 'center',
        marginBottom: 40,
    },
    recipient: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#4F46E5',
        textAlign: 'center',
        marginBottom: 20,
        borderBottom: '1px solid #E5E7EB',
        paddingBottom10: 10,
    },
    body: {
        fontSize: 14,
        color: '#374151',
        textAlign: 'center',
        lineHeight: 1.6,
        marginBottom: 60,
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    qrPlaceholder: {
        width: 80,
        height: 80,
        backgroundColor: '#F3F4F6',
        textAlign: 'center',
        fontSize: 10,
        paddingTop: 30,
    },
    signature: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'right',
    },
});

interface CertificateDocumentProps {
    userName: string;
    seriesName: string;
    completionDate: string;
    verifyUrl: string;
}

export const CertificateDocument: React.FC<CertificateDocumentProps> = ({
    userName,
    seriesName,
    completionDate,
    verifyUrl,
}) => (
    <Document>
        <Page size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.border}>
                <Text style={styles.header}>CERTIFICATE OF COMPLETION</Text>
                <Text style={styles.title}>CampusConnect</Text>
                <Text style={styles.subtitle}>This is to certify that</Text>
                <Text style={styles.recipient}>{userName}</Text>
                <Text style={styles.body}>
                    has successfully completed the{' '}
                    <Text style={{ fontWeight: 'bold' }}>{seriesName}</Text>{' '}
                    event series, demonstrating dedication and active participation.
                </Text>
                <Text style={styles.body}>
                    Date of Completion: {completionDate}
                </Text>

                <View style={styles.footer}>
                    <View>
                        <View style={styles.qrPlaceholder}>
                            QR Code
                        </View>
                        <Text style={{ fontSize: 8, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
                            Verify at: {verifyUrl}
                        </Text>
                    </View>
                    <View style={styles.signature}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>
                            CampusConnect Administration
                        </Text>
                        <Text>Official Digital Credential</Text>
                    </View>
                </View>
            </View>
        </Page>
    </Document>
);
