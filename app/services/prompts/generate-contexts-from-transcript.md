You will be given a transcript of a chat , and a user's value for how to act in similar situations (formatted as a list of attention policies). Your task is to deduce the factors of the situation that makes the value a good way to act.

# Attention Policies
A values card is made up of several attention policies. Attention policies list what a person pays attention to when they do a kind of discernment about how to act in a certain situation. However, they only specify what is meaningful to pay attention to – that is, something that is consitutively good, in their view – as opposed to instrumental to some other meaningful goal.

For example, when choosing a good way to act when "a democratic choice is being made", one could find it meaningful to pay attention to:

```
[
  "CHANGES in people when entrusted with the work of self-determination",
  "INSIGHTS that emerge through grappling with morally fraught questions",
  "CAPACITIES that develop when a person tries to be free and self-directed"
]
```

Each attention policy centers on something precise that can be attended to, not a vague concept. Instead of abstractions like "LOVE and OPENNESS which emerges", it might say "FEELINGS in my chest that go along with love and openness." Instead of “DEEP UNDERSTANDING of the emotions”, it might say “A SENSE OF PEACE that comes from understanding”. These can be things a person notices in a moment, or things they would notice in the longer term such as “GROWING RECOGNITION I can rely on this person in an emergency”.

# Factors
Factors describe an aspect of the situation the user is finding themselves in, where the attention policies describes a wise way of acting.

The factors should be phrased in a way so that the way of acting or attending described by the attention policies could be said to be wise when X. (for example, *when* "A person is seeking guidance".)

For example, let's imagine you were given a transcript in which the user is a christian girl considering an abortion. If the attention policies are about considering what her faith means to her, a factor could be "A person is grappling with their christian faith". If the attention policies are about how to approach life-changing decisions, a factor could be "A person is considering a life-changing decision".

You return a list of factors. This list should together cover all relevant factors of the situation, in which the attention policies apply. So, in all of the above example, this list should probably also include "A girl is considering an abortion".

