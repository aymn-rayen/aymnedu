from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from fastapi import HTTPException
from typing import Optional, List

from app.models import Eleve, Paiement, PaiementStatutEnum, InscriptionGroupe
from app.schemas.eleve import (
    EleveCreate, EleveUpdate, EleveQuickSummary, EleveGroupeSummary, EleveUnpaidPaiement,
    EleveInscriptionCompleteRequest, EleveInscriptionCompleteOut, EleveOut
)


def _build_search_filter(q: str):
    """
    Construit un filtre de recherche souple et intelligent :
    - Correspondance si le prénom contient q ou le nom contient q
    - Correspondance sur le nom complet combiné : 'Prénom Nom' ou 'Nom Prénom'
      (ex: 'Chinez Lounis' ou 'Lounis Chinez')
    - Correspondance par mot individuel séparé par un espace
    """
    clean_q = q.strip()
    like = f"%{clean_q}%"

    full_name_1 = func.concat(Eleve.prenom, " ", Eleve.nom)
    full_name_2 = func.concat(Eleve.nom, " ", Eleve.prenom)

    conditions = [
        Eleve.prenom.ilike(like),
        Eleve.nom.ilike(like),
        full_name_1.ilike(like),
        full_name_2.ilike(like),
    ]

    # Si l'utilisateur tape plusieurs mots (ex: "Chinez Lounis"), on cherche aussi les élèves matchant les 2
    tokens = [t.strip() for t in clean_q.split() if len(t.strip()) >= 2]
    if len(tokens) > 1:
        # Match si tous les tokens se retrouvent dans prenom ou nom
        for t in tokens:
            t_like = f"%{t}%"
            conditions.append(full_name_1.ilike(t_like))

    return or_(*conditions)


def list_eleves(
    db: Session,
    centre_id: int,
    q: Optional[str] = None,
    page: int = 1,
    size: int = 25
):
    # Filtre les élèves non supprimés (deleted_at IS NULL)
    query = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None  # noqa: E711
    )
    if q and q.strip():
        query = query.filter(_build_search_filter(q))
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": -(-total // size)
    }


def search_eleves(db: Session, centre_id: int, q: str) -> list[Eleve]:
    """
    Lightweight full-text search for the groupe-management modal.
    Returns up to 50 active eleves matching q (prenom, nom ou nom complet).
    """
    if not q or len(q.strip()) < 2:
        return []
    return (
        db.query(Eleve)
        .filter(
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,  # noqa: E711
            Eleve.statut == "actif",
            _build_search_filter(q)
        )
        .order_by(Eleve.nom, Eleve.prenom)
        .limit(50)
        .all()
    )


def quick_search_cashier(db: Session, centre_id: int, q: str) -> List[EleveQuickSummary]:
    """
    Killer Feature / Fast Cashier Search (Ctrl + K):
    Returns student card info with class/level, assigned groups, and unpaid dues.
    Prend en charge la recherche par prénom, nom, ou nom complet ('Chinez Lounis').
    """
    if not q or len(q.strip()) < 2:
        return []

    eleves = (
        db.query(Eleve)
        .options(
            joinedload(Eleve.inscriptions).joinedload(InscriptionGroupe.groupe),
            joinedload(Eleve.paiements).joinedload(Paiement.groupe)
        )
        .filter(
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,  # noqa: E711
            _build_search_filter(q)
        )
        .order_by(Eleve.nom, Eleve.prenom)
        .limit(20)
        .all()
    )

    results: List[EleveQuickSummary] = []
    for el in eleves:
        # Groupes
        groupes_summary = [
            EleveGroupeSummary(
                id=ig.groupe.id,
                nom=ig.groupe.nom,
                matiere=ig.groupe.matiere,
                niveau=ig.groupe.niveau
            )
            for ig in el.inscriptions
            if ig.groupe and ig.groupe.deleted_at is None
        ]

        # Impayés et partiels
        impayes_list: List[EleveUnpaidPaiement] = []
        total_reste = 0.0

        for p in el.paiements:
            if p.statut in (PaiementStatutEnum.impaye, PaiementStatutEnum.partiel, "impaye", "partiel"):
                m_total = float(p.montant or 0)
                m_verse = float(p.montant_verse or 0)
                reste = max(0.0, m_total - m_verse)
                total_reste += reste
                impayes_list.append(
                    EleveUnpaidPaiement(
                        id=p.id,
                        groupe_id=p.groupe_id,
                        groupe_nom=p.groupe.nom if p.groupe else "Groupe",
                        mois=p.mois,
                        montant=m_total,
                        montant_verse=m_verse,
                        reste=reste,
                        statut=p.statut.value if hasattr(p.statut, 'value') else str(p.statut)
                    )
                )

        results.append(
            EleveQuickSummary(
                id=el.id,
                prenom=el.prenom,
                nom=el.nom,
                niveau=el.niveau,
                telephone_responsable=el.telephone_responsable,
                statut=el.statut.value if hasattr(el.statut, 'value') else str(el.statut),
                groupes=groupes_summary,
                total_reste_du=round(total_reste, 2),
                impayes=impayes_list
            )
        )

    return results


def get_eleve(db: Session, centre_id: int, eleve_id: int) -> Eleve:
    """Récupère un élève actif (non supprimé). Lève 404 si soft-deleted."""
    eleve = db.query(Eleve).filter(
        Eleve.id == eleve_id,
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None  # noqa: E711
    ).first()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    return eleve


def create_eleve(db: Session, centre_id: int, data: EleveCreate) -> Eleve:
    from app.services.subscription_service import assert_subscription_allows_write
    assert_subscription_allows_write(db, centre_id)
    eleve = Eleve(**data.model_dump(), centre_id=centre_id)
    db.add(eleve)
    db.commit()
    db.refresh(eleve)
    return eleve


def update_eleve(db: Session, centre_id: int, eleve_id: int, data: EleveUpdate) -> Eleve:
    eleve = get_eleve(db, centre_id, eleve_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(eleve, field, val)
    db.commit()
    db.refresh(eleve)
    return eleve


def delete_eleve(db: Session, centre_id: int, eleve_id: int) -> None:
    """Soft delete — positionne deleted_at au timestamp actuel."""
    eleve = get_eleve(db, centre_id, eleve_id)
    eleve.deleted_at = func.now()
    db.commit()


def inscription_complete(
    db: Session,
    centre_id: int,
    user_id: int,
    data: EleveInscriptionCompleteRequest
) -> EleveInscriptionCompleteOut:
    """
    Inscription 'Tout-en-un' en une seule transaction SQL atomique :
    1. Validation de l'abonnement et des quotas
    2. Création de l'élève
    3. Inscription dans les groupes sélectionnés (avec vérification de capacité)
    4. Création des échéances mensuelles au tarif officiel de chaque groupe (Snapshot)
    5. Encaissement immédiat optionnel (avec création de ligne Versement, reçu unique et verrou)
    """
    from decimal import Decimal
    from datetime import datetime, timezone
    import secrets
    from app.models import Groupe, InscriptionGroupe, Paiement, PaiementStatutEnum, Versement
    from app.services.subscription_service import assert_subscription_allows_write

    assert_subscription_allows_write(db, centre_id)

    # 1. Mois par défaut si non spécifié
    now_utc = datetime.now(timezone.utc)
    mois_courant = data.mois if data.mois and len(data.mois) == 7 else now_utc.strftime("%Y-%m")

    # 2. Création de l'élève
    eleve = Eleve(
        centre_id=centre_id,
        prenom=data.prenom.strip(),
        nom=data.nom.strip(),
        telephone_responsable=data.telephone_responsable.strip() if data.telephone_responsable else None,
        niveau=data.niveau.strip() if data.niveau else None,
    )
    db.add(eleve)
    db.flush()  # génère eleve.id

    groupes_inscrits: List[EleveGroupeSummary] = []
    total_tarif = Decimal("0.00")
    created_paiements: List[Paiement] = []

    # 3. Traitement des groupes
    if data.groupe_ids:
        # Récupère les groupes demandés avec verrou pessimiste
        groupes = db.query(Groupe).filter(
            Groupe.id.in_(data.groupe_ids),
            Groupe.centre_id == centre_id,
            Groupe.deleted_at == None
        ).with_for_update().all()

        if len(groupes) != len(data.groupe_ids):
            raise HTTPException(status_code=400, detail="Un ou plusieurs groupes sélectionnés sont introuvables.")

        for g in groupes:
            # Vérification de capacité
            current_nb = db.query(InscriptionGroupe).filter(InscriptionGroupe.groupe_id == g.id).count()
            if current_nb >= g.capacite_max:
                raise HTTPException(
                    status_code=400,
                    detail=f"Le groupe '{g.nom}' a atteint sa capacité maximale ({g.capacite_max} élèves)."
                )

            # Inscription
            insc = InscriptionGroupe(eleve_id=eleve.id, groupe_id=g.id)
            db.add(insc)

            # Snapshot du tarif du groupe
            tarif_snapshot = Decimal(str(g.tarif if g.tarif is not None else 2500)).quantize(Decimal("0.01"))
            total_tarif += tarif_snapshot

            p = Paiement(
                centre_id=centre_id,
                eleve_id=eleve.id,
                groupe_id=g.id,
                montant=tarif_snapshot,
                montant_verse=Decimal("0.00"),
                mois=mois_courant,
                statut=PaiementStatutEnum.impaye,
            )
            db.add(p)
            created_paiements.append(p)

            groupes_inscrits.append(
                EleveGroupeSummary(
                    id=g.id,
                    nom=g.nom,
                    matiere=g.matiere,
                    niveau=g.niveau
                )
            )

        db.flush()

    # 4. Encaissement immédiat optionnel
    total_verse = Decimal("0.00")
    dernier_recu: Optional[str] = None

    if data.encaisser_maintenant and created_paiements:
        montant_a_distribuer = (
            Decimal(str(data.montant_verse)).quantize(Decimal("0.01"))
            if data.montant_verse and data.montant_verse > 0
            else total_tarif
        )

        reste_distribution = montant_a_distribuer
        date_code = now_utc.strftime("%Y%m%d")

        for p in created_paiements:
            if reste_distribution <= Decimal("0.00"):
                break

            montant_du = p.montant - p.montant_verse
            part = min(reste_distribution, montant_du)
            if part > Decimal("0.00"):
                p.montant_verse += part
                total_verse += part
                reste_distribution -= part

                if p.montant_verse >= p.montant:
                    p.statut = PaiementStatutEnum.paye
                else:
                    p.statut = PaiementStatutEnum.partiel

                p.date_paiement = now_utc
                rand_suffix = secrets.token_hex(3).upper()
                recu_num = f"REC-{date_code}-{p.id:04d}-{rand_suffix}"
                p.recu_numero = recu_num
                dernier_recu = recu_num

                v = Versement(
                    paiement_id=p.id,
                    centre_id=centre_id,
                    recu_par_user_id=user_id,
                    montant=part,
                    mode_reglement=data.mode_reglement or "especes",
                    recu_numero=recu_num,
                    date_versement=now_utc,
                )
                db.add(v)

    db.commit()
    db.refresh(eleve)

    reste_final = max(Decimal("0.00"), total_tarif - total_verse)

    return EleveInscriptionCompleteOut(
        eleve=EleveOut.model_validate(eleve),
        groupes_inscrits=groupes_inscrits,
        total_tarif=float(total_tarif),
        total_verse=float(total_verse),
        reste_a_payer=float(reste_final),
        recu_numero=dernier_recu,
    )
