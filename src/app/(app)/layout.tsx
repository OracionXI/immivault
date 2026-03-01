import { AppLayout } from "@/components/layout/app-layout";
import { InitGate } from "@/components/init-gate";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
    return (
        <InitGate>
            <AppLayout>{children}</AppLayout>
        </InitGate>
    );
}
