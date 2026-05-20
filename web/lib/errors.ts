export function parseTxError(e: unknown, fallback: string): string {
  if (typeof e !== "object" || e === null) return fallback;
  const err = e as {
    code?: string | number;
    shortMessage?: string;
    reason?: string;
    message?: string;
    data?: { message?: string; data?: string } | string;
    info?: { error?: { code?: number; message?: string; data?: string } };
    revert?: { name?: string };
  };
  const raw = (
    (typeof err.data === "object" ? err.data?.message : undefined) ??
    err.info?.error?.message ??
    err.reason ??
    err.shortMessage ??
    err.message ??
    ""
  ).toLowerCase();
  const revertName = err.revert?.name ?? "";

  const rawData =
    err.info?.error?.data ??
    (typeof err.data === "string" ? err.data : err.data?.data) ??
    "";
  const selector = typeof rawData === "string" && rawData.startsWith("0x") ? rawData.slice(0, 10).toLowerCase() : "";
  const SELECTORS: Record<string, string> = {
    "0xe450d38c": "Saldo insuficiente del token requerido para completar la operación.",
    "0xfb8f41b2": "Approve insuficiente: la wallet no autorizó al contrato a mover los tokens.",
    "0x5274afe7": "La transferencia del token falló. Verifica saldo y approve."
  };
  if (selector && SELECTORS[selector]) return SELECTORS[selector];
  if (revertName === "ERC20InsufficientBalance" || raw.includes("erc20insufficientbalance")) {
    return "Saldo insuficiente del token requerido para completar la operación.";
  }
  if (revertName === "ERC20InsufficientAllowance" || raw.includes("erc20insufficientallowance")) {
    return "Approve insuficiente: la wallet no autorizó al contrato a mover los tokens.";
  }
  if (revertName === "SafeERC20FailedOperation" || raw.includes("safeerc20failedoperation")) {
    return "La transferencia del token falló. Verifica saldo y approve.";
  }
  if (revertName === "TokenNotAllowed") return "El token utilizado no está permitido en el contrato.";
  if (revertName === "InvalidParams") return "Parámetros inválidos para la operación.";
  if (revertName === "NotAuthorized") return "No estás autorizado para esta acción.";
  if (revertName === "CannotCompleteOwn") return "No puedes completar tu propia operación.";
  if (revertName === "InvalidStatus") return "La operación ya no está activa (puede haber sido completada o cancelada).";
  if (revertName === "OperationNotFound") return "Operación no encontrada.";

  const rejectionCode =
    err.code === "ACTION_REJECTED" ||
    err.code === 4001 ||
    err.info?.error?.code === 4001;
  if (
    rejectionCode ||
    raw.includes("user rejected") ||
    raw.includes("user denied") ||
    raw.includes("rejected the request")
  ) {
    return "Transacción rechazada en la wallet.";
  }
  if (raw.includes("insufficient funds")) {
    return "No tienes suficiente ETH para pagar el gas.";
  }
  if (
    raw.includes("erc20: transfer amount exceeds balance") ||
    raw.includes("transfer amount exceeds balance") ||
    raw.includes("insufficient balance")
  ) {
    return "Saldo insuficiente del token requerido para completar la operación.";
  }
  if (
    raw.includes("erc20: insufficient allowance") ||
    raw.includes("insufficient allowance")
  ) {
    return "Approve insuficiente: la wallet no autorizó al contrato a mover los tokens.";
  }
  if (raw.includes("operation not active") || raw.includes("not active")) {
    return "La operación ya no está activa (puede haber sido completada o cancelada).";
  }
  if (raw.includes("only creator") || raw.includes("not creator")) {
    return "Solo el creador puede cancelar esta operación.";
  }
  if (raw.includes("cannot complete own") || raw.includes("own operation")) {
    return "No puedes completar tu propia operación.";
  }
  if (raw.includes("token not allowed")) {
    return "El token utilizado no está permitido en el contrato.";
  }
  if (raw.includes("nonce")) {
    return "Conflicto de nonce: reinicia la wallet o vuelve a intentarlo.";
  }
  if (raw.includes("network") || raw.includes("disconnect") || raw.includes("timeout")) {
    return "Problema de red al enviar la transacción. Intenta de nuevo.";
  }
  if (raw.includes("already pending") || raw.includes("request already pending")) {
    return "Ya hay una solicitud pendiente en la wallet. Revisa MetaMask.";
  }
  if (err.shortMessage) return err.shortMessage;
  if (err.message) return err.message;
  return fallback;
}

export function parseReadError(e: unknown, fallback: string): string {
  if (typeof e !== "object" || e === null) return fallback;
  const err = e as { shortMessage?: string; reason?: string; message?: string };
  const raw = (err.reason ?? err.shortMessage ?? err.message ?? "").toLowerCase();
  if (raw.includes("could not decode") || raw.includes("bad_data")) {
    return "Respuesta inesperada del contrato. Verifica que estés en la red correcta.";
  }
  if (raw.includes("network") || raw.includes("disconnect") || raw.includes("timeout")) {
    return "Problema de red al leer del contrato. Intenta refrescar.";
  }
  if (raw.includes("call_exception") || raw.includes("missing revert data")) {
    return "El contrato no respondió. Revisa la dirección del Escrow y la red.";
  }
  return err.shortMessage ?? err.reason ?? err.message ?? fallback;
}
