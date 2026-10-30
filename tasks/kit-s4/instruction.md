# Form handling can be made to modify inherited object members

## The system

This project is a full-stack web framework. A page defines a server-side form and spreads the
resulting form object onto a `<form>` element. The framework keeps a live copy of the form's
current values in the browser and updates it as the controls change, then serializes it when the
form is submitted. The form object also exposes field accessors that
read and assign individual values. Field names in the markup say where each value lives in the
stored copy: a plain name, names separated by dots for nested values, and numeric indices in
brackets for arrays. A control can also have no value at all — an emptied file picker is the
common case — and the framework removes that field from the stored copy.

## Observed problem

A form contains an emptied file picker whose name is a nested path, and the browser fires the
ordinary input event for that control. When one part of the path is a name that every JavaScript
object inherits, the framework removes a property from a shared object instead of removing the
form's own stored value. The change is visible to unrelated code on the same page: a property
that was present on a shared object is gone afterwards.

## What must hold (invariant)

No field name that comes with form input may add, change or remove a property on any object's
prototype chain, wherever the framework turns a field name into a change to its stored values. A
change that would do so is refused: it does not take effect, the form's previously stored values
stay as they were, and no object outside the form's own stored values is modified.

The example above shows how the problem appears, not the full set of names, field kinds or path
shapes. Reason about the property, not the sample.

## Contracts the fix must honour

- **Refusal.** A refused update changes nothing: nothing is stored or removed for it, no shared
  object is touched, and the page keeps working. The refusal is an ordinary client-side
  rejection, not a failed navigation or an error page.
- **Removal.** Clearing a field removes that field from the stored values; it does not leave the
  name behind holding a null or undefined value. Clearing a path that had no stored value
  changes nothing and must not create empty containing objects or arrays.
- **Stored values.** A value that is legitimately stored as undefined is still a stored field,
  distinct from one that was removed; assigning such a value keeps it stored.
- **Ordinary names.** Plain, dotted and indexed field names keep binding exactly as today, for
  every kind of control, and clearing a control still removes that field's stored value. Values of
  other fields are preserved when one field changes, and everything that works today keeps working
  exactly as today.
- **Interfaces.** The form object's field accessors keep their existing behaviour: reading a
  field's value returns what is stored at its path, and assigning through an accessor stores the
  value at that path.

## Constraints

- Fix the underlying problem and its close variants, not only the example.
- Keep every legitimate use working.
- Do not special-case the example inputs.
- Do not consult any upstream fix, advisory or changelog for this project.
- There is no network access.
