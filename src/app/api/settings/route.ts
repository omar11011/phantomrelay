import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeInput } from '@/lib/utils';

export async function GET() {
  try {
    const configs = await db.resendConfig.findMany();

    const maskedConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey
        ? c.apiKey.slice(0, 4) + '••••••••' + c.apiKey.slice(-4)
        : '',
      apiKeyFull: undefined,
    }));

    return NextResponse.json({ configs: maskedConfigs }, { status: 200 });
  } catch (error) {
    console.error('Settings GET error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, name, apiKey, senderEmail, senderName, isDefault } = body;

    switch (action) {
      case 'create': {
        if (!name || !apiKey || !senderEmail) {
          return NextResponse.json(
            { error: 'Nombre, API key y correo remitente son obligatorios' },
            { status: 400 }
          );
        }

        if (!apiKey.startsWith('re_')) {
          return NextResponse.json(
            { error: 'La API key debe comenzar con "re_" (formato Resend)' },
            { status: 400 }
          );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(senderEmail)) {
          return NextResponse.json(
            { error: 'El correo remitente no es válido' },
            { status: 400 }
          );
        }

        const config = await db.resendConfig.create({
          name: sanitizeInput(name),
          apiKey: apiKey.trim(),
          senderEmail: senderEmail.trim().toLowerCase(),
          senderName: sanitizeInput(senderName || 'PhantomRelay'),
          isDefault: isDefault === true,
        });

        return NextResponse.json({ success: true, config }, { status: 201 });
      }

      case 'update': {
        if (!id) {
          return NextResponse.json(
            { error: 'ID de configuración es obligatorio' },
            { status: 400 }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = sanitizeInput(name);
        if (apiKey !== undefined) {
          if (!apiKey.startsWith('re_')) {
            return NextResponse.json(
              { error: 'La API key debe comenzar con "re_" (formato Resend)' },
              { status: 400 }
            );
          }
          updateData.apiKey = apiKey.trim();
        }
        if (senderEmail !== undefined) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(senderEmail)) {
            return NextResponse.json(
              { error: 'El correo remitente no es válido' },
              { status: 400 }
            );
          }
          updateData.senderEmail = senderEmail.trim().toLowerCase();
        }
        if (senderName !== undefined) updateData.senderName = sanitizeInput(senderName);
        if (isDefault !== undefined) updateData.isDefault = isDefault;

        const config = await db.resendConfig.update({ id }, updateData);
        return NextResponse.json({ success: true, config }, { status: 200 });
      }

      case 'delete': {
        if (!id) {
          return NextResponse.json(
            { error: 'ID de configuración es obligatorio' },
            { status: 400 }
          );
        }

        await db.resendConfig.delete({ id });
        return NextResponse.json({ success: true }, { status: 200 });
      }

      case 'set_default': {
        if (!id) {
          return NextResponse.json(
            { error: 'ID de configuración es obligatorio' },
            { status: 400 }
          );
        }

        await db.resendConfig.update({ id }, { isDefault: true });
        return NextResponse.json({ success: true }, { status: 200 });
      }

      default:
        return NextResponse.json(
          { error: 'Acción no válida. Usa: create, update, delete, set_default' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Settings POST error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
