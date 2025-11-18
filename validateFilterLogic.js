if (filter.isHD) {
    validate ONLY against Donaldson();
}
if (filter.isLD) {
    validate ONLY against Fram();
}
if (!confirmedCrossReference) {
    return { status: "no_confirmed_equivalence" };
}
