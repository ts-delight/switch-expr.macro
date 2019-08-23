interface SwitchChain<TTarget = never, TResult = never> {
  case<R>(expr: TTarget, result: R): SwitchChain<TTarget, TResult | R>;
  default<R>(result: R): SwitchChain<TTarget, TResult | R>;
  end(): TResult;
}

declare function Switch<TTarget>(target: TTarget): SwitchChain<TTarget, never>;

export = Switch;
