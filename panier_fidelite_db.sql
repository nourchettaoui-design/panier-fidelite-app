--
-- PostgreSQL database dump
--

\restrict iGhh1QRe8acIxOS5cQij4a3M71hy0MbAlgbbHqKAkHJhZRLO1KLAaAc5ZftDOpL

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

-- Started on 2026-07-27 00:39:10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 223 (class 1255 OID 16436)
-- Name: maj_date_expiration_par_utilisation(); Type: FUNCTION; Schema: public; Owner: myuser
--

CREATE FUNCTION public.maj_date_expiration_par_utilisation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF (TG_OP = 'INSERT') THEN
        IF NEW.last_utilisation IS NULL THEN
          NEW.last_utilisation := NEW.date_ouverture;
        END IF;
        NEW.date_expiration := (NEW.last_utilisation + INTERVAL '1 year')::date;
        RETURN NEW;
      END IF;

      IF (TG_OP = 'UPDATE') THEN
        IF NEW.last_utilisation IS DISTINCT FROM OLD.last_utilisation THEN
          NEW.date_expiration := (NEW.last_utilisation + INTERVAL '1 year')::date;
        END IF;
        RETURN NEW;
      END IF;

      RETURN NEW;
    END;
    $$;


ALTER FUNCTION public.maj_date_expiration_par_utilisation() OWNER TO myuser;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 16405)
-- Name: paniers_fidelite; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.paniers_fidelite (
    id integer NOT NULL,
    utilisateur_id integer NOT NULL,
    date_ouverture date DEFAULT CURRENT_DATE NOT NULL,
    date_expiration date,
    points integer DEFAULT 0 NOT NULL,
    date_maj timestamp with time zone DEFAULT now(),
    actif boolean DEFAULT true,
    last_utilisation date,
    date_desactivation timestamp with time zone,
    raison_desactivation character varying(100),
    supprime boolean DEFAULT false,
    numero_carte character varying(64)
);


ALTER TABLE public.paniers_fidelite OWNER TO myuser;

--
-- TOC entry 219 (class 1259 OID 16404)
-- Name: paniers_fidelite_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.paniers_fidelite_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paniers_fidelite_id_seq OWNER TO myuser;

--
-- TOC entry 4889 (class 0 OID 0)
-- Dependencies: 219
-- Name: paniers_fidelite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.paniers_fidelite_id_seq OWNED BY public.paniers_fidelite.id;


--
-- TOC entry 222 (class 1259 OID 16422)
-- Name: points_transactions; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.points_transactions (
    id integer NOT NULL,
    panier_id integer NOT NULL,
    type character varying(10) NOT NULL,
    montant integer NOT NULL,
    motif character varying(255),
    date_creation timestamp with time zone DEFAULT now(),
    annee integer NOT NULL,
    CONSTRAINT points_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying, 'transfer'::character varying])::text[])))
);


ALTER TABLE public.points_transactions OWNER TO myuser;

--
-- TOC entry 221 (class 1259 OID 16421)
-- Name: points_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.points_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.points_transactions_id_seq OWNER TO myuser;

--
-- TOC entry 4890 (class 0 OID 0)
-- Dependencies: 221
-- Name: points_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.points_transactions_id_seq OWNED BY public.points_transactions.id;


--
-- TOC entry 218 (class 1259 OID 16391)
-- Name: utilisateurs; Type: TABLE; Schema: public; Owner: myuser
--

CREATE TABLE public.utilisateurs (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    telephone character varying(30),
    adresse text,
    mot_de_passe character varying(255),
    role character varying(20) DEFAULT 'client'::character varying NOT NULL,
    date_creation timestamp with time zone DEFAULT now(),
    CONSTRAINT utilisateurs_role_check CHECK (((role)::text = ANY ((ARRAY['utilisateur'::character varying, 'administrateur'::character varying])::text[])))
);


ALTER TABLE public.utilisateurs OWNER TO myuser;

--
-- TOC entry 217 (class 1259 OID 16390)
-- Name: utilisateurs_id_seq; Type: SEQUENCE; Schema: public; Owner: myuser
--

CREATE SEQUENCE public.utilisateurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.utilisateurs_id_seq OWNER TO myuser;

--
-- TOC entry 4891 (class 0 OID 0)
-- Dependencies: 217
-- Name: utilisateurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: myuser
--

ALTER SEQUENCE public.utilisateurs_id_seq OWNED BY public.utilisateurs.id;


--
-- TOC entry 4709 (class 2604 OID 16408)
-- Name: paniers_fidelite id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.paniers_fidelite ALTER COLUMN id SET DEFAULT nextval('public.paniers_fidelite_id_seq'::regclass);


--
-- TOC entry 4715 (class 2604 OID 16425)
-- Name: points_transactions id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.points_transactions ALTER COLUMN id SET DEFAULT nextval('public.points_transactions_id_seq'::regclass);


--
-- TOC entry 4706 (class 2604 OID 16394)
-- Name: utilisateurs id; Type: DEFAULT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.utilisateurs ALTER COLUMN id SET DEFAULT nextval('public.utilisateurs_id_seq'::regclass);


--
-- TOC entry 4881 (class 0 OID 16405)
-- Dependencies: 220
-- Data for Name: paniers_fidelite; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.paniers_fidelite (id, utilisateur_id, date_ouverture, date_expiration, points, date_maj, actif, last_utilisation, date_desactivation, raison_desactivation, supprime, numero_carte) FROM stdin;
1	3	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000001
2	4	2026-03-01	2027-03-01	0	2026-05-26 17:28:40.029761+02	t	2026-03-01	\N	\N	f	100000000002
3	5	2026-01-10	2027-01-10	5	2026-05-26 17:28:40.029761+02	t	2026-01-10	\N	\N	f	100000000003
4	5	2023-01-15	2024-01-15	12	2026-05-26 17:28:40.029761+02	f	2023-01-15	2023-01-15 00:00:00+01	\N	f	100000000004
5	6	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000005
6	7	2026-04-20	2027-04-20	8	2026-05-26 17:28:40.029761+02	t	2026-04-20	\N	\N	f	100000000006
7	7	2022-10-15	2023-10-15	20	2026-05-26 17:28:40.029761+02	f	2022-10-15	2022-10-15 00:00:00+02	\N	f	100000000007
8	7	2023-02-01	2024-02-01	7	2026-05-26 17:28:40.029761+02	f	2023-02-01	2023-02-01 00:00:00+01	\N	f	100000000008
9	8	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000009
10	9	2026-02-05	2027-02-05	2	2026-05-26 17:28:40.029761+02	t	2026-02-05	\N	\N	f	100000000010
11	9	2023-03-10	2024-03-10	14	2026-05-26 17:28:40.029761+02	f	2023-03-10	2023-03-10 00:00:00+01	\N	f	100000000011
12	10	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000012
13	11	2026-01-20	2027-01-20	0	2026-05-26 17:28:40.029761+02	t	2026-01-20	\N	\N	f	100000000013
14	12	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000014
15	13	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000015
16	14	2026-04-01	2027-04-01	3	2026-05-26 17:28:40.029761+02	t	2026-04-01	\N	\N	f	100000000016
17	14	2022-11-20	2023-11-20	18	2026-05-26 17:28:40.029761+02	f	2022-11-20	2022-11-20 00:00:00+01	\N	f	100000000017
18	14	2023-01-05	2024-01-05	6	2026-05-26 17:28:40.029761+02	f	2023-01-05	2023-01-05 00:00:00+01	\N	f	100000000018
19	15	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000019
20	16	2026-02-28	2027-02-28	0	2026-05-26 17:28:40.029761+02	t	2026-02-28	\N	\N	f	100000000020
21	17	2026-03-10	2027-03-10	4	2026-05-26 17:28:40.029761+02	t	2026-03-10	\N	\N	f	100000000021
22	17	2023-04-01	2024-04-01	10	2026-05-26 17:28:40.029761+02	f	2023-04-01	2023-04-01 00:00:00+02	\N	f	100000000022
23	18	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000023
24	19	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000024
25	20	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000025
26	21	2026-01-15	2027-01-15	1	2026-05-26 17:28:40.029761+02	t	2026-01-15	\N	\N	f	100000000026
27	21	2022-09-30	2023-09-30	25	2026-05-26 17:28:40.029761+02	f	2022-09-30	2022-09-30 00:00:00+02	\N	f	100000000027
28	21	2023-02-20	2024-02-20	9	2026-05-26 17:28:40.029761+02	f	2023-02-20	2023-02-20 00:00:00+01	\N	f	100000000028
29	22	2026-05-26	2027-05-26	0	2026-05-26 17:28:40.029761+02	t	2026-05-26	\N	\N	f	100000000029
\.


--
-- TOC entry 4883 (class 0 OID 16422)
-- Dependencies: 222
-- Data for Name: points_transactions; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.points_transactions (id, panier_id, type, montant, motif, date_creation, annee) FROM stdin;
1	3	credit	5	Solde historique	2026-01-10 01:00:00+01	2026
2	4	credit	12	Solde historique	2023-01-15 01:00:00+01	2023
3	6	credit	8	Solde historique	2026-04-20 02:00:00+02	2026
4	7	credit	20	Solde historique	2022-10-15 02:00:00+02	2022
5	8	credit	7	Solde historique	2023-02-01 01:00:00+01	2023
6	10	credit	2	Solde historique	2026-02-05 01:00:00+01	2026
7	11	credit	14	Solde historique	2023-03-10 01:00:00+01	2023
8	16	credit	3	Solde historique	2026-04-01 02:00:00+02	2026
9	17	credit	18	Solde historique	2022-11-20 01:00:00+01	2022
10	18	credit	6	Solde historique	2023-01-05 01:00:00+01	2023
11	21	credit	4	Solde historique	2026-03-10 01:00:00+01	2026
12	22	credit	10	Solde historique	2023-04-01 02:00:00+02	2023
13	26	credit	1	Solde historique	2026-01-15 01:00:00+01	2026
14	27	credit	25	Solde historique	2022-09-30 02:00:00+02	2022
15	28	credit	9	Solde historique	2023-02-20 01:00:00+01	2023
\.


--
-- TOC entry 4879 (class 0 OID 16391)
-- Dependencies: 218
-- Data for Name: utilisateurs; Type: TABLE DATA; Schema: public; Owner: myuser
--

COPY public.utilisateurs (id, nom, prenom, email, telephone, adresse, mot_de_passe, role, date_creation) FROM stdin;
1	Cassel	Sophie	manager1@example.com	0612345678	1 Rue du Siège, 75001 Paris	$2b$10$dVF/6LmZoGvqW/.M6StygOPOpT2aqr6CCV4zpBUIB9Gvd1ECxf7Je	administrateur	2026-05-26 17:28:40.029761+02
2	Martin	Cedric	manager2@example.com	0612345679	2 Rue du Siège, 75002 Paris	$2b$10$ysAjDir9dRKDkmXeBpO2M.DzYyb1MDxql7VFyUJQVyM93sD2CFteK	administrateur	2026-05-26 17:28:40.029761+02
4	Moreau	Claire	manager1.user02@example.com	0601020302	11 Rue Volta, 75003 Paris	$2b$10$yOBbHKPNhwy9ZqrY7exvjO4mG.Az4JNPLLTPgoy3c9EaaTgtqRC3O	utilisateur	2026-05-26 17:28:40.029761+02
5	Dupont	Julien	manager1.user03@example.com	0601020303	12 Rue Volta, 75003 Paris	$2b$10$vKF3k99VEgWRmoQFUqyCheNp22s6DtW08.SXTCVLahbb855ounHFa	utilisateur	2026-05-26 17:28:40.029761+02
6	Bernard	Amélie	manager1.user04@example.com	0601020304	13 Rue Volta, 75003 Paris	$2b$10$DybAs8KjKQDCVnR5abgUzuv9R.ryBBLNgOAn.dlm.nqvQV5YicVRy	utilisateur	2026-05-26 17:28:40.029761+02
7	Roux	Thomas	manager1.user05@example.com	0601020305	14 Rue Volta, 75003 Paris	$2b$10$ocu.2UUOO2T2OychUozoVuWRQJodyI8rn.ddi.G2Vw6XLRmqsVKdO	utilisateur	2026-05-26 17:28:40.029761+02
8	Petit	Lucie	manager1.user06@example.com	0601020306	15 Rue du Petit Pont, 75005 Paris	$2b$10$/QCn8gIqpiOomLGoeBeJA.OUKqYCsSLI56/.R6DMLzFmlgCoxxTJm	utilisateur	2026-05-26 17:28:40.029761+02
9	Robert	Hugo	manager1.user07@example.com	0601020307	16 Rue du Petit Pont, 75005 Paris	$2b$10$zOu3FFL1LQWd.xobaWlCLOjlyrEwaK/1Xg2qI9k8WvTL6/G6/0IT6	utilisateur	2026-05-26 17:28:40.029761+02
10	Durand	Élodie	manager1.user08@example.com	0601020308	17 Rue du Petit Pont, 75005 Paris	$2b$10$HNq8jntZhCUfpZ0PMX1Gv.XCsUshVTm.f7hdjxGM3G5du/O/JdRN.	utilisateur	2026-05-26 17:28:40.029761+02
11	Dubois	Marc	manager1.user09@example.com	0601020309	18 Rue du Petit Pont, 75005 Paris	$2b$10$XhFo3DCOIUwI9xmHiJPa9eCjOAJ1z.oOm2EBLnhfANw1VJ8Hfxe4C	utilisateur	2026-05-26 17:28:40.029761+02
12	Morel	Nina	manager1.user10@example.com	0601020310	19 Rue du Petit Pont, 75005 Paris	$2b$10$LxmAEnZrRVDzutp3e9PPcek8DmuHiinBZCWz04PLYDtC6fiwyRJsG	utilisateur	2026-05-26 17:28:40.029761+02
13	Petitjean	Antoine	manager2.user01@example.com	0602030401	20 Rue du Bac, 75007 Paris	$2b$10$OQzbq/diqHeemkH8mJt9E.2Y8p5A8p3.yKiQlh1iUpi8sQDzbLCLu	utilisateur	2026-05-26 17:28:40.029761+02
14	Gauthier	Sophie	manager2.user02@example.com	0602030402	21 Rue du Bac, 75007 Paris	$2b$10$jvbMcATwIeWEsAbVcsGyuunK60cFHF5YnOx7blbhgD7YZOcEw/UuC	utilisateur	2026-05-26 17:28:40.029761+02
15	Leroy	David	manager2.user03@example.com	0602030403	22 Rue du Bac, 75007 Paris	$2b$10$IZipcbXpsqtIOBiVOtnMjusrjO8CIEYw2Rwt3DbGUY9nUsE/jY.ru	utilisateur	2026-05-26 17:28:40.029761+02
16	Fabre	Manon	manager2.user04@example.com	0602030404	23 Rue du Bac, 75007 Paris	$2b$10$YN82M.NPAEO9RdPCwr5nX.QD5XUxJaLldtoMnd/d5vPqhNhcw4Eam	utilisateur	2026-05-26 17:28:40.029761+02
17	Blanc	Alexandre	manager2.user05@example.com	0602030405	24 Rue de Grenelle, 75007 Paris	$2b$10$pBJA/SHUd1PjJ0ECtQ.d6unL6714TIuXbnyZW8cT.86XARnUi31Ai	utilisateur	2026-05-26 17:28:40.029761+02
18	Garnier	Inès	manager2.user06@example.com	0602030406	25 Rue de Grenelle, 75007 Paris	$2b$10$4ZaxnrdqNfvyEUih4KT4qulRdACBBdKZRI3nrQj5oWCTSXp03Cdq6	utilisateur	2026-05-26 17:28:40.029761+02
19	Meyer	Pauline	manager2.user07@example.com	0602030407	26 Rue de Grenelle, 75007 Paris	$2b$10$VSqbojii9TP2D47UIPzQ9O6b3eTiQP4E.wjsBZZYYNWLpFfHFC4bu	utilisateur	2026-05-26 17:28:40.029761+02
20	Colin	Romain	manager2.user08@example.com	0602030408	27 Rue de Grenelle, 75007 Paris	$2b$10$pu8wWCA0qLVPhHYkOPxwY.6vuPs1eUtigAUY1WpL0CWwraUIQXa86	utilisateur	2026-05-26 17:28:40.029761+02
21	Durand	Claire	manager2.user09@example.com	0602030409	28 Rue de Grenelle, 75007 Paris	$2b$10$uaQhwrDC7o95L2Sto45RkOCb6a7XsBL536mXzHSWfQR37GRIAUFgy	utilisateur	2026-05-26 17:28:40.029761+02
22	Baron	Lucas	manager2.user10@example.com	0602030410	29 Rue de Grenelle, 75007 Paris	$2b$10$p6X5tPjTXt2YKIHOkZTqpeJpxJhw9jPeX5aCkCYCbobpHQL7kVEjO	utilisateur	2026-05-26 17:28:40.029761+02
3	Lefevre	Paul	manager1.user01@example.com	0601020301	10 Rue Volta, 75003 Paris	$2b$10$NuCefVH/XTYiGZjSAKD5lOcmz9TSfgPXZhXwE0gtLvTVQLibAPwO2	utilisateur	2026-05-26 17:28:40.029761+02
\.


--
-- TOC entry 4892 (class 0 OID 0)
-- Dependencies: 219
-- Name: paniers_fidelite_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.paniers_fidelite_id_seq', 29, true);


--
-- TOC entry 4893 (class 0 OID 0)
-- Dependencies: 221
-- Name: points_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.points_transactions_id_seq', 15, true);


--
-- TOC entry 4894 (class 0 OID 0)
-- Dependencies: 217
-- Name: utilisateurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: myuser
--

SELECT pg_catalog.setval('public.utilisateurs_id_seq', 22, true);


--
-- TOC entry 4725 (class 2606 OID 16415)
-- Name: paniers_fidelite paniers_fidelite_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.paniers_fidelite
    ADD CONSTRAINT paniers_fidelite_pkey PRIMARY KEY (id);


--
-- TOC entry 4729 (class 2606 OID 16429)
-- Name: points_transactions points_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4720 (class 2606 OID 16403)
-- Name: utilisateurs utilisateurs_email_key; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_email_key UNIQUE (email);


--
-- TOC entry 4722 (class 2606 OID 16401)
-- Name: utilisateurs utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);


--
-- TOC entry 4727 (class 1259 OID 16435)
-- Name: idx_pts_panier_annee; Type: INDEX; Schema: public; Owner: myuser
--

CREATE INDEX idx_pts_panier_annee ON public.points_transactions USING btree (panier_id, annee);


--
-- TOC entry 4723 (class 1259 OID 16439)
-- Name: idx_un_panier_actif_par_utilisateur; Type: INDEX; Schema: public; Owner: myuser
--

CREATE UNIQUE INDEX idx_un_panier_actif_par_utilisateur ON public.paniers_fidelite USING btree (utilisateur_id) WHERE ((actif = true) AND (supprime = false));


--
-- TOC entry 4726 (class 1259 OID 16438)
-- Name: ux_paniers_numero_carte; Type: INDEX; Schema: public; Owner: myuser
--

CREATE UNIQUE INDEX ux_paniers_numero_carte ON public.paniers_fidelite USING btree (numero_carte);


--
-- TOC entry 4732 (class 2620 OID 16437)
-- Name: paniers_fidelite trg_maj_date_expiration; Type: TRIGGER; Schema: public; Owner: myuser
--

CREATE TRIGGER trg_maj_date_expiration BEFORE INSERT OR UPDATE ON public.paniers_fidelite FOR EACH ROW EXECUTE FUNCTION public.maj_date_expiration_par_utilisation();


--
-- TOC entry 4730 (class 2606 OID 16416)
-- Name: paniers_fidelite paniers_fidelite_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.paniers_fidelite
    ADD CONSTRAINT paniers_fidelite_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;


--
-- TOC entry 4731 (class 2606 OID 16430)
-- Name: points_transactions points_transactions_panier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myuser
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_panier_id_fkey FOREIGN KEY (panier_id) REFERENCES public.paniers_fidelite(id) ON DELETE CASCADE;


-- Completed on 2026-07-27 00:39:10

--
-- PostgreSQL database dump complete
--

\unrestrict iGhh1QRe8acIxOS5cQij4a3M71hy0MbAlgbbHqKAkHJhZRLO1KLAaAc5ZftDOpL

