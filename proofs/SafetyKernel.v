(* File: proofs/SafetyKernel.v
   ProofBridge Liner — Formal Safety Kernel
   -----------------------------------------
   Structural formalisation of the circuit-breaker state machine in Coq.
   The key theorem: UNAUTH actors can never reset a HALTED kernel.
   This file can be compiled with: coqc proofs/SafetyKernel.v
*)

Require Import QArith.

(* ------------------------------------------------------------------ *)
(*  Types                                                               *)
(* ------------------------------------------------------------------ *)

Inductive State := OPEN | HALTED.

Inductive Actor := AUTH | UNAUTH.

Record KernelInput := {
  posterior  : Q;
  threshold  : Q;
  actor      : Actor
}.

(* ------------------------------------------------------------------ *)
(*  Transition Function                                                  *)
(* ------------------------------------------------------------------ *)

(** [step s i] computes the next state from current state [s] and
    input [i].  The HALTED state is absorbing for UNAUTH actors. *)
Definition step (s : State) (i : KernelInput) : State :=
  match s with
  | OPEN =>
      if Qle_bool i.(threshold) i.(posterior)
      then HALTED
      else OPEN
  | HALTED =>
      match i.(actor) with
      | AUTH   => OPEN
      | UNAUTH => HALTED
      end
  end.

(* ------------------------------------------------------------------ *)
(*  Theorems                                                             *)
(* ------------------------------------------------------------------ *)

(** Theorem 1 (Absorbing HALTED for UNAUTH):
    An UNAUTH actor can never reset the circuit.
    The HALTED state is absorbing when actor = UNAUTH. *)
Theorem unauthorized_halt_is_absorbing :
  forall (i : KernelInput),
    i.(actor) = UNAUTH ->
    step HALTED i = HALTED.
Proof.
  intros i H.
  simpl.
  rewrite H.
  reflexivity.
Qed.

(** Theorem 2 (Monotone tripping):
    If the posterior meets or exceeds the threshold,
    the OPEN state transitions to HALTED. *)
Theorem posterior_above_threshold_trips :
  forall (i : KernelInput),
    Qle_bool i.(threshold) i.(posterior) = true ->
    step OPEN i = HALTED.
Proof.
  intros i H.
  simpl.
  rewrite H.
  reflexivity.
Qed.

(** Theorem 3 (Safe below threshold):
    If the posterior is strictly below the threshold, OPEN stays OPEN. *)
Theorem posterior_below_threshold_stays_open :
  forall (i : KernelInput),
    Qle_bool i.(threshold) i.(posterior) = false ->
    step OPEN i = OPEN.
Proof.
  intros i H.
  simpl.
  rewrite H.
  reflexivity.
Qed.

(** Theorem 4 (AUTH can reset):
    An AUTH actor always resets a HALTED kernel to OPEN. *)
Theorem auth_can_reset :
  forall (i : KernelInput),
    i.(actor) = AUTH ->
    step HALTED i = OPEN.
Proof.
  intros i H.
  simpl.
  rewrite H.
  reflexivity.
Qed.
