import { TVB_COLORS } from './config.js';

function rgb([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

const red = rgb(TVB_COLORS.t);      // traffic
const yellow = rgb(TVB_COLORS.v);   // voices
const green = rgb(TVB_COLORS.b);    // birds


export const labelsEng = {
        "langage": "Language",
        "lang": "eng",
        "mapMode": "Map Mode",
        "noiseButton": "LAeq 40-100dBA",
        "sourcesButton": "Sound Sources",
        "navigationTitle": "Navigation",
        "tutorialButton": "Tutorial",
        "soundSourcesTitle": "Sound Sources",
        "t": "Traffic",
        "traffic": "Traffic",
        "v": "Voices",
        "voices": "Voices",
        "b": "Birds",
        "birds": "Birds",
        "periodToggleTitle": "Time Period",
      
        // Mouse Over
        "MOSensor": "Sensor",
        "MOTime": "Time",
        "MOPeriod": "Period",
      
        // Period selection
        "dropdownOption1": "No Lockdown / Lockdown",
        "preLockdown": "Pre-Lockdown",
        "lockdown": "Lockdown",
        "dropdownOption2": "Day / Night",
        "day": "Day",
        "night": "Night",
        "dropdownOption3": "Workday / Saturday",
        "workday": "Workday",
        "saturday": "Saturday",
      
        "compare": "Compare",
        "timeScale": "Time Scale",
        "hourOfDay": "Hours of Day",
        "dayOfWeek": "Days of Week",
        "rotateTip": "💡 Hold <strong>Ctrl</strong> (or Cmd) to rotate the view",
      
        // Tutorial
        "tutorialToggle": "Tutorial",
        "tutorialTitle": "Introduction",
        "tutorialContent":
          "<p>You are about to explore data recorded by <strong>52 acoustic sensors</strong> distributed across the city of Lorient, " +
          "which operated simultaneously throughout the year 2020.</p>" +
      
          "<p>At each moment, we estimated the level of presence of <strong>three sound sources</strong>:</p>" +
      
          "<ul class='tutorial-list'>" +
            "<li><strong>Traffic</strong> noise</li>" +
            "<li><strong>Human voices</strong></li>" +
            "<li><strong>Bird</strong> songs</li>" +
          "</ul>" +
      
          "<p>This data is available for each of these sensors.</p>",
      
        "Qi_1": `You are about to explore data recorded by <strong>52 acoustic sensors</strong> 
                 distributed across the city of Lorient, which operated simultaneously throughout the year 2020.`,
      
        "Q1_1": `On the map, each symbol represents the <strong>average sound presence</strong> of a sensor for 
                 <strong style="color: ${red}">traffic</strong>, 
                 <strong style="color: ${yellow}">voices</strong>, and 
                 <strong style="color: ${green}">birds</strong>.
                 The circle is divided into three sections, one for each sound source. 
                 The radius of each section is proportional to its <strong>presence level</strong>, 
                 and the dashed outline indicates the <strong>maximum possible level</strong>.
                 Hover over a symbol to display the sensor's name.`,
      
        "Q1_2": `If some <strong>sound sources</strong> seem irrelevant to your analysis,
                you can choose to <strong>hide</strong> them by <strong>unchecking</strong> them in the <strong>"Sound Sources"</strong> menu.`,
      
        "Q1_3": `Depending on the <strong>zoom level</strong>, some sensor symbols may be <strong>hidden</strong>.
                The <strong>number shown at the top right</strong> of a symbol indicates the <strong>number of hidden sensors</strong> underneath.
                <strong>Zoom in</strong> with the <strong>mouse wheel</strong>, and 
                <strong>pan</strong> by holding the <strong>left mouse button</strong>.`,
      
        "Q1_4": `❓ <strong><u><em>QUESTION 1:</em></u></strong> Among the <strong>two displayed symbols</strong>,  
                which one shows a <strong>higher presence of birds</strong>?`,
      
        "Q2_1": `So far, you’ve been observing data from the period <strong>March to May 2020</strong>,  
                corresponding to the <strong>COVID-19 lockdown</strong>. 
                You can now click on the <strong>“Pre-Lockdown”</strong> button 
                to display data from <strong>January to March 2020</strong>.`,
      
        "Q2_2": `The <strong>“Compare”</strong> button <span id="inlineModeButtonCompare"></span> lets you view 
                <strong>both periods</strong> simultaneously on a single symbol,  
                split into <strong>2 half-circles</strong>.`,
      
        "Q2_3": `❓ <strong><u><em>QUESTION 2:</em></u></strong> On which of the <strong>two sensors</strong>  
                did the <strong>presence level of birds</strong> change the most between <strong>before</strong> and 
                <strong>during lockdown</strong>?`,
      
        "Q3_1": `While holding the <strong>left mouse button</strong> and pressing <strong>Ctrl</strong> (or <strong>Opt</strong>),  
                you can <strong>rotate the view</strong>.`,
      
        "Q3_2": `Click on a <strong>sensor symbol</strong> to reveal its <strong>data column</strong>.
                This column represents the <strong>daily averages</strong> of the presence of the three sound sources.
                Only the <strong>most present sound source</strong> is shown in each section of the column.
                The <strong>radius</strong> of the section indicates the <strong>presence level</strong> of this dominant source.`,
      
        "Q3_3": `You can <strong>show or hide</strong> sound sources by <strong>unchecking</strong> them 
                in the <strong>"Sound Sources"</strong> menu,  
                to display the sections corresponding to <strong>less dominant</strong> sources.`,
      
        "Q3_4": `You can also <strong>change the time scale</strong> to show <strong>averages by day of the week</strong>.`,
      
        "Q3_5": `❓ <strong><u><em>QUESTION 3:</em></u></strong> Among the <strong>two sensors</strong> whose columns are displayed,  
                which one shows <strong>more voices</strong> between <strong>1pm and 8pm</strong>? 
                Does the <strong>presence of voices</strong> appear to be <strong>different depending on the day of the week</strong>?`,
      
        "Q4_1": `The <strong>“Pre-Lockdown”</strong> and <strong>“Compare”</strong> buttons <span id="inlineModeButtonCompare"></span> 
                also work with the <strong>data columns</strong>.`,
      
        "Q4_2": `❓ <strong><u><em>QUESTION 4:</em></u></strong> On which of the <strong>two sensors</strong>  
                did the <strong>presence level of birds</strong> change the most between <strong>before</strong> and  
                <strong>during lockdown</strong>, between <strong>16:00 and 20:00</strong>?`,
      
        "Q5_1": `You will now explore data from the same sensors, but this time comparing data from 
                <strong>weekdays</strong> (Monday to Friday) with <strong>Saturdays</strong>.
                You can now use the navigation buttons, which let you reset the view to 2D <span id="inlineTwoDButton"></span>, and 
                reset the view <span id="inlineResetButton"></span>.`,
      
        "Q5_2": `❓ <strong><u><em>QUESTION 5:</em></u></strong> While exploring this part of the map and comparing several sensors, find a <strong>sensor</strong> that seems particularly
                <strong>more lively at night on Saturday</strong> than during the week.`
      };

// Libellés en français pour l'application
export const labelsFr = {
  "langage": "Langue",
  "lang": "fr",
  "mapMode": "Mode Carte",
  "noiseButton": "LAeq 40-100dBA",
  "sourcesButton": "Sources sonores",
  "navigationTitle": "Navigation",
  "tutorialButton": "Tutoriel",
  "soundSourcesTitle": "Sources sonores",
  "t" : "Trafic",
  "traffic": "Trafic",
  "v": "Voix",
  "voices": "Voix",
  "b": "Oiseaux",
  "birds": "Oiseaux",
  "periodToggleTitle": "Période",

  // Mouse Over
  "MOSensor": "Capteur",
  "MOTime": "Temps",
  "MOPeriod": "Période",

  // Sélection de période
  "dropdownOption1": "Sans / Avec Confinement",
  "preLockdown": "Pré-confinement",
  "lockdown": "Confinement",
  "dropdownOption2": "Jour / Nuit",
  "day": "Jour",
  "night": "Nuit",
  "dropdownOption3": "Jour Ouvré / Samedi",
  "workday": "Jour Ouvré",
  "saturday": "Samedi",

  "compare": "Comparer",
  "timeScale": "Échelle Temporelle",
  "hourOfDay": "Heures Journée",
  "dayOfWeek": "Jours Semaine",
  "rotateTip": "💡 Maintenez <strong>Ctrl</strong> (ou <strong>Opt</strong>) pour faire pivoter la vue",

  // Tutoriel
  "tutorialToggle": "Tutoriel",
  "tutorialTitle": "Introduction",
  "tutorialContent":
    "<p>Vous allez explorer les données enregistrées par <strong>52 capteurs acoustiques</strong> répartis dans la ville de Lorient, " +
    "ayant fonctionné simultanément au cours de l'année 2020.</p>" +

    "<p>Nous avons estimé, à chaque instant, le niveau de présence de <strong>trois sources sonores</strong> :</p>" +

    "<ul class='tutorial-list'>" +
      "<li>Le <strong>trafic</strong> routier</li>" +
      "<li>Les <strong>voix</strong> humaines</li>" +
      "<li>Les chants d’<strong>oiseaux</strong></li>" +
    "</ul>" +

    "<p>Ces données sont disponibles pour chacun de ces capteurs.</p>",

    // "i" intro (1 pages)
    "Qi_1": `Vous allez explorer les données enregistrées par <strong>52 capteurs acoustiques</strong> 
            répartis dans la ville de Lorient,
            ayant fonctionné simultanément au cours de l'année 2020.`,

    // Q1 (4 pages)
    "Q1_1": `Sur la carte, chaque symbole représente la <strong>moyenne de présence sonore</strong> d'un capteur pour le 
             <strong style="color: ${red}">trafic</strong> routier, les 
             <strong style="color: ${yellow}">voix</strong> humaines, et les chants d'<strong style="color: ${green}">oiseaux</strong>.
             Le cercle est divisé en trois sections, une pour chaque source sonore. 
             Le rayon de chaque section est proportionnel à son <strong>niveau de présence</strong>, 
             et le cercle en pointillés indique le <strong>niveau maximal</strong> possible.
             Passez la souris sur un symbole pour afficher le nom du capteur.`,

    "Q1_2": `Si certaines <strong>sources sonores</strong> ne vous paraissent pas pertinentes dans le cadre de votre analyse,
            vous pouvez choisir de les <strong>masquer</strong> en les <strong>décochant</strong> dans le menu <strong>"Sources sonores"</strong>`,
    
    "Q1_3": `En fonction du <strong>niveau de zoom</strong>, certains symboles de capteurs peuvent 
             être <strong>masqués</strong>.
             Le <strong>nombre indiqué en haut à droite</strong> d’un symbole correspond au <strong>nombre de capteurs cachés</strong> 
             en dessous.
             <strong>Zoomez</strong> avec la <strong>molette de la souris</strong>, et 
             <strong>déplacez-vous</strong> en maintenant le <strong>clic gauche</strong> enfoncé.`,
    "Q1_4": `❓ <strong><u><em>QUESTION 1:</em></u></strong> Parmi les <strong>deux symboles</strong> affichés,  
            lequel représente une <strong>présence d’oiseaux plus élevée</strong> ?`,

    
    // Q2 (3 pages)
    "Q2_1": `Jusqu’à présent, vous avez observé les données de la période allant de <strong>mars à mai 2020</strong>,  
            correspondant au <strong>confinement lié au COVID-19</strong>. 
            Vous pouvez maintenant cliquer sur le bouton <strong>« Pré-Confinement »</strong> 
            pour afficher les données de la période de <strong>janvier à mars 2020</strong>.`,

    "Q2_2": `Le bouton <strong>« Comparaison »</strong> <span id="inlineModeButtonCompare"></span>  vous permet de visualiser simultanément 
            les <strong>deux périodes</strong> sur un même symbole,  
            en le divisant en <strong>2 demi-cercles</strong>.`,

    "Q2_3": `❓ <strong><u><em>QUESTION 2:</em></u></strong> Sur lequel des <strong>deux capteurs</strong>  
            le <strong>niveau de présence des oiseaux</strong> a-t-il le plus changé entre <strong>avant</strong> et 
            <strong>pendant le confinement</strong> ?`,

    // Q3 (4 pages)
    "Q3_1": `En maintenant le <strong>clic gauche</strong> de la souris tout en appuyant sur la touche <strong>Ctrl</strong> (ou <strong>Opt</strong>),  
            vous pouvez <strong>faire pivoter l’angle de vue</strong>.`,

    "Q3_2": `Cliquez sur le <strong>symbole d’un capteur</strong>, pour faire apparaitre sa <strong>colonne de données</strong>.
            Cette colonne représente les <strong>moyennes journalières</strong> de présence des trois sources sonores.
            Seule la <strong>source sonore la plus présente</strong> est affichée dans chaque section de la colonne.
            Le <strong>rayon</strong> de cette section indique le <strong>niveau de présence</strong> de cette source dominante.`,

    "Q3_3": `Vous pouvez <strong>afficher ou masquer</strong> les sources sonores en les <strong>décochant</strong>
             dans le menu <strong>"Sources sonores"</strong>,  
             afin de faire apparaître les sections correspondant aux sources <strong>moins dominantes</strong>.`,

    "Q3_4": `Vous pouvez également <strong>changer l’échelle temporelle</strong> pour afficher les <strong>moyennes par
             jour de la semaine</strong>.`,

    "Q3_5": `❓ <strong><u><em>QUESTION 3:</em></u></strong> Parmi les <strong>deux capteurs</strong> dont les colonnes sont affichées,  
            lequel présente le <strong>plus de voix</strong> entre <strong>13h et 20h</strong> ? La <strong>présence des voix</strong> 
            vous semble-t-elle <strong>différente selon les jours de la semaine</strong> ?`,

    // Q4 (2 pages)
    "Q4_1": `Les boutons <strong>« Pré-Confinement »</strong> et <strong>« Comparaison »</strong> <span id="inlineModeButtonCompare"></span> 
            fonctionnent aussi avec les <strong>colonnes de données</strong>.`,

    "Q4_2": `❓ <strong><u><em>QUESTION 4:</em></u></strong> Sur lequel des <strong>deux capteurs</strong>  
            le <strong>niveau de présence des oiseaux</strong> a-t-il le plus changé entre <strong>avant</strong> et  
            <strong>pendant le confinement</strong>, entre <strong>16h et 20h</strong> ?`,

    // Q5 (2 pages)
    "Q5_1": `Vous allez explorer les données issues des mêmes capteurs, mais cette fois en comparant les données de 
            <strong>jours de semaine</strong> (du lundi au vendredi) avec celles des <strong>samedis</strong>.
            Vous pouvez désormais utiliser les boutons de navigation, qui vous permettent de repasser la vue en 2D  <span id="inlineTwoDButton"></span>, et 
            de réinitialiser la vue  <span id="inlineResetButton"></span>.`,

    "Q5_2": `❓ <strong><u><em>QUESTION 5:</em></u></strong> En explorant cette portion de la carte et en comparant plusieurs capteurs, trouvez un <strong>capteur</strong> qui vous semble particulièrement
            <strong>plus animé la nuit le samedi</strong> que pendant la semaine.`

};

export const labels = {
        fr: labelsFr,
        eng: labelsEng
      };