package seg.jUCMNav.tests.oracle;

import java.io.File;
import java.io.InputStream;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;

import org.eclipse.emf.common.util.URI;
import org.eclipse.emf.ecore.resource.Resource;
import org.eclipse.emf.ecore.resource.ResourceSet;
import org.eclipse.emf.ecore.resource.impl.ResourceSetImpl;
import org.eclipse.emf.ecore.xmi.impl.XMIResourceFactoryImpl;
import org.junit.Test;

import grl.Actor;
import grl.EvaluationStrategy;
import grl.GRLLinkableElement;
import grl.IntentionalElement;
import seg.jUCMNav.strategies.BatchEvaluationUtil;
import seg.jUCMNav.strategies.EvaluationStrategyManager;
import seg.jUCMNav.views.preferences.StrategyEvaluationPreferences;
import urn.URNspec;

/**
 * goal-controller's oracle (#105 D1): every element and actor of every seed,
 * under every strategy, as jUCMNav's own BatchEvaluationUtil evaluates them,
 * with the preferences fixed per run. Reads /seeds/*.jucm, writes
 * /out/<seed>.csv. Not one of jUCMNav's tests: goal-controller's docker image
 * adds it to the test fragment and runs it alone.
 */
public class OracleTest {

    /** algorithm, tolerance: the runs */
    private static final Object[][] RUNS = {
            { "quantitative", StrategyEvaluationPreferences.QUANTITATIVE_ALGORITHM, 0 },
            { "quantitative", StrategyEvaluationPreferences.QUANTITATIVE_ALGORITHM, 10 },
            { "qualitative", StrategyEvaluationPreferences.QUALITATIVE_ALGORITHM, 0 }, };

    @Test
    public void evaluateSeeds() throws Exception {
        File[] seeds = new File("/seeds").listFiles((dir, name) -> name.endsWith(".jucm"));
        Arrays.sort(seeds);
        for (File seed : seeds) {
            String out = "/out/" + seed.getName().replaceAll("\\.jucm$", "") + ".csv";
            URNspec urn;
            try {
                urn = load(seed);
            } catch (Exception e) {
                try (PrintWriter csv = new PrintWriter(out, "UTF-8")) {
                    csv.println("ERROR," + quote(e.getMessage()));
                }
                System.out.println("oracle: " + out + " (not loaded: " + e.getMessage() + ")");
                continue;
            }
            List<EvaluationStrategy> strategies = new ArrayList<>(urn.getGrlspec().getStrategies());
            try (PrintWriter csv = new PrintWriter(out, "UTF-8")) {
                csv.println("algorithm,tolerance,strategy,strategyName,kind,id,value,label");
                for (Object[] run : RUNS) {
                    StrategyEvaluationPreferences.setAlgorithm(run[1].toString());
                    StrategyEvaluationPreferences.setTolerance((Integer) run[2]);
                    HashMap<EvaluationStrategy, HashMap<GRLLinkableElement, Integer>> table = BatchEvaluationUtil
                            .calculateAllEvaluations(strategies, urn.getGrlspec());
                    for (EvaluationStrategy strategy : strategies) {
                        HashMap<GRLLinkableElement, Integer> values = table.get(strategy);
                        for (Iterator<?> it = urn.getGrlspec().getIntElements().iterator(); it.hasNext();)
                            row(csv, run, strategy, urn, "element", (IntentionalElement) it.next(), values);
                        for (Iterator<?> it = urn.getGrlspec().getActors().iterator(); it.hasNext();)
                            row(csv, run, strategy, urn, "actor", (Actor) it.next(), values);
                    }
                }
            }
            System.out.println("oracle: " + out);
        }
        EvaluationStrategyManager.getInstance(false).setStrategy(null);
    }

    private static void row(PrintWriter csv, Object[] run, EvaluationStrategy strategy, URNspec urn, String kind,
            GRLLinkableElement element, HashMap<GRLLinkableElement, Integer> values) {
        Integer value = values == null ? null : values.get(element);
        if (value == null)
            return;
        Object label = EvaluationStrategyManager.getQualitativeEvaluationForQuantitativeValue(urn, value);
        csv.println(String.join(",", run[0].toString(), run[2].toString(), strategy.getId(), quote(strategy.getName()),
                kind, element.getId(), value.toString(), label == null ? "" : label.toString()));
    }

    /** Each intElement with the ids of its links out (`linksSrc`) and in (`linksDest`), from the links. */
    private static String withElementLinks(String text) {
        HashMap<String, List<String>> out = new HashMap<>();
        HashMap<String, List<String>> in = new HashMap<>();
        java.util.regex.Matcher link = java.util.regex.Pattern.compile("<links [^>]*>").matcher(text);
        while (link.find()) {
            String tag = link.group();
            String id = attribute(tag, "id"), src = attribute(tag, "src"), dest = attribute(tag, "dest");
            if (id == null || src == null || dest == null)
                continue;
            out.computeIfAbsent(src, k -> new ArrayList<>()).add(id);
            in.computeIfAbsent(dest, k -> new ArrayList<>()).add(id);
        }
        java.util.regex.Matcher element = java.util.regex.Pattern.compile("<intElements [^>]*?(/?>)").matcher(text);
        StringBuffer result = new StringBuffer();
        while (element.find()) {
            String tag = element.group();
            String id = attribute(tag, "id");
            String extra = "";
            if (id != null && in.containsKey(id))
                extra += " linksDest=\"" + String.join(" ", in.get(id)) + "\"";
            if (id != null && out.containsKey(id))
                extra += " linksSrc=\"" + String.join(" ", out.get(id)) + "\"";
            String close = element.group(1);
            element.appendReplacement(result,
                    java.util.regex.Matcher.quoteReplacement(tag.substring(0, tag.length() - close.length()) + extra + close));
        }
        element.appendTail(result);
        return result.toString();
    }

    private static String attribute(String tag, String name) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\s" + name + "=\"([^\"]*)\"").matcher(tag);
        return m.find() ? m.group(1) : null;
    }

    private static String quote(String text) {
        return "\"" + (text == null ? "" : text.replace("\"", "\"\"")) + "\"";
    }

    /**
     * A seed, loaded. jUCMNav's 2014 files (SmartHome2) name their features
     * `grl:Feature` and their feature diagram `grl:FeatureModel`; jUCMNavPlus
     * moved them to its `fm` package (`fm:Feature`, `fm:FeatureDiagram`), so
     * those two types are renamed, and the `fm` namespace declared, first.
     */
    private static URNspec load(File seed) throws Exception {
        String text = new String(java.nio.file.Files.readAllBytes(seed.toPath()), "UTF-8");
        if (text.contains("\"grl:Feature"))
            text = text.replace("xsi:type=\"grl:Feature\"", "xsi:type=\"fm:Feature\"")
                    .replace("xsi:type=\"grl:FeatureModel\"", "xsi:type=\"fm:FeatureDiagram\"")
                    // the 2014 element type Feature, which jUCMNavPlus doesn't have (no algorithm reads a type)
                    .replace(" type=\"Feature\"", " type=\"Task\"")
                    .replaceFirst("<urn:URNspec ", "<urn:URNspec xmlns:fm=\"http:///fm.ecore\" ");
        // GoalCat ids its LinkRefs and has links refer to them (`refs`), which
        // jUCMNavPlus's LinkRef can't resolve: a link's drawings, which no algorithm reads
        if (text.contains("<connections xsi:type=\"grl:LinkRef\" id="))
            text = text.replaceAll("(<links [^>]*?) refs=\"[^\"]*\"", "$1");
        // GoalCat names a link's ends on the link only (`src`, `dest`); jUCMNav
        // resolves them from the elements' side (`linksSrc`, `linksDest`), which
        // its own files write: written here from the links
        if (!text.contains("linksDest=") && !text.contains("linksSrc="))
            text = withElementLinks(text);
        ResourceSet rs = new ResourceSetImpl();
        rs.getResourceFactoryRegistry().getExtensionToFactoryMap().put("jucm", new XMIResourceFactoryImpl()); //$NON-NLS-1$
        Resource r = rs.createResource(URI.createURI(seed.getName()));
        // attributes this metamodel doesn't have (GoalCat writes a LinkRef's id) are kept aside, not errors
        HashMap<Object, Object> options = new HashMap<>();
        options.put(org.eclipse.emf.ecore.xmi.XMLResource.OPTION_RECORD_UNKNOWN_FEATURE, Boolean.TRUE);
        try (InputStream in = new java.io.ByteArrayInputStream(text.getBytes("UTF-8"))) {
            r.load(in, options);
        }
        return (URNspec) r.getContents().get(0);
    }
}
