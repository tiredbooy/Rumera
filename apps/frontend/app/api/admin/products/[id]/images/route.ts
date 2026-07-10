import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { API_BASE } from "@/lib/api/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const formData = await req.formData();

  const res = await fetch(`${API_BASE}/admin/products/${id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: formData,
  });

  const body = await res.json().catch(() => null);
  return NextResponse.json(body, { status: res.status });
}
